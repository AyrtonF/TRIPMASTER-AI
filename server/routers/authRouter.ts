import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV, requireEnvValue } from "../_core/env";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  getUserByEmailOrUsername,
  createUserLocal,
  updateUserPassword,
  updateUserResetToken,
  getUserByResetToken,
  getLoginAttempt,
  upsertLoginAttempt,
  clearLoginAttempt,
} from "../db";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getLoginKey(identifier: string) {
  return identifier.trim().toLowerCase();
}

async function checkBruteForce(identifier: string) {
  const record = await getLoginAttempt(identifier);
  if (!record) {
    return;
  }

  if (record.lockedUntil && Date.now() < record.lockedUntil.getTime()) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas falhas. Tente novamente em 15 minutos.",
    });
  }

  if (record.attempts >= MAX_ATTEMPTS && record.lockedUntil && Date.now() >= record.lockedUntil.getTime()) {
    await clearLoginAttempt(identifier);
  }
}

async function recordFailedAttempt(identifier: string) {
  const record = await getLoginAttempt(identifier);
  const attempts = (record?.attempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : record?.lockedUntil ?? null;
  await upsertLoginAttempt(identifier, attempts, lockedUntil);
}

async function clearFailedAttempts(identifier: string) {
  await clearLoginAttempt(identifier);
}

function getJwtSecret() {
  return requireEnvValue(ENV.jwtSecret, "JWT_SECRET");
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
        username: z.string().min(3, "Nome de usuário muito curto"),
        password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const existingUser = await getUserByEmailOrUsername(input.email);
        const existingUserByName = await getUserByEmailOrUsername(input.username);

        if (existingUser || existingUserByName) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email ou nome de usuário já em uso",
          });
        }

        const passwordHash = await bcrypt.hash(input.password, 10);

        const userId = await createUserLocal({
          email: input.email,
          username: input.username,
          password: passwordHash,
        });

        return { success: true, userId };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("[auth.register]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar conta.",
        });
      }
    }),

  login: publicProcedure
    .input(
      z.object({
        identifier: z.string().min(1, "Email ou usuário obrigatório"),
        password: z.string().min(1, "Senha obrigatória"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lockIdentifier = getLoginKey(input.identifier);

      try {
        await checkBruteForce(lockIdentifier);

        const user = await getUserByEmailOrUsername(input.identifier);

        if (!user || !user.password) {
          await recordFailedAttempt(lockIdentifier);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Credenciais inválidas",
          });
        }

        const isValid = await bcrypt.compare(input.password, user.password);

        if (!isValid) {
          await recordFailedAttempt(lockIdentifier);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Credenciais inválidas",
          });
        }

        await clearFailedAttempts(lockIdentifier);

        const token = jwt.sign(
          { userId: user.id },
          getJwtSecret(),
          { expiresIn: "7d" }
        );

        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("[auth.login]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao autenticar.",
        });
      }
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, {
      ...getSessionCookieOptions(ctx.req),
      maxAge: -1,
    });

    return { success: true } as const;
  }),

  recoverPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmailOrUsername(input.email);
      if (!user) {
        // Return success even if not found to prevent user enumeration
        return { success: true };
      }

      // Generate token
      const resetToken = crypto.randomUUID();
      const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await updateUserResetToken(user.id, resetToken, expiry);

      // Send email via Nodemailer
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured.");
        return { success: true, warning: "SMTP não configurado." };
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Use dynamic origin to support any IP or port
      const host = ctx.req?.headers?.origin || (ctx.req?.headers?.referer ? new URL(ctx.req.headers.referer).origin : "http://192.168.1.60:5173");
      const resetLink = `${host}/reset-password?token=${resetToken}`;

      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: input.email,
          subject: "TripMaster AI - Recuperação de Senha",
          html: `<p>Você solicitou a recuperação de senha.</p>
                 <p>Clique no link abaixo para redefinir sua senha:</p>
                 <a href="${resetLink}">${resetLink}</a>
                 <p>Este link é válido por 1 hora.</p>`,
        });
      } catch (error) {
        console.error("Failed to send email:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao enviar email de recuperação.",
        });
      }

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      const user = await getUserByResetToken(input.token);

      if (!user || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token inválido ou expirado.",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await updateUserPassword(user.id, passwordHash);
      await updateUserResetToken(user.id, null, null);

      return { success: true };
    }),
});
