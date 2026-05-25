import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import {
  getUserByEmailOrUsername,
  createUserLocal,
  updateUserPassword,
  updateUserResetToken,
  getUserByResetToken,
} from "../db";

// Brute Force Protection (In-memory)
// Keys: IP address or email/username
// Values: { attempts: number, lockedUntil: number }
const bruteForceMap = new Map<string, { attempts: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkBruteForce(identifier: string) {
  const record = bruteForceMap.get(identifier);
  if (record) {
    if (Date.now() < record.lockedUntil) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas falhas. Tente novamente em 15 minutos.",
      });
    } else if (Date.now() >= record.lockedUntil && record.attempts >= MAX_ATTEMPTS) {
      // Reset after lockout period
      bruteForceMap.delete(identifier);
    }
  }
}

function recordFailedAttempt(identifier: string) {
  const record = bruteForceMap.get(identifier) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  bruteForceMap.set(identifier, record);
}

function clearFailedAttempts(identifier: string) {
  bruteForceMap.delete(identifier);
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
        username: z.string().min(3, "Nome de usuário muito curto"),
        password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
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
    }),

  login: publicProcedure
    .input(
      z.object({
        identifier: z.string().min(1, "Email ou usuário obrigatório"),
        password: z.string().min(1, "Senha obrigatória"),
      })
    )
    .mutation(async ({ input }) => {
      const lockIdentifier = input.identifier.toLowerCase();
      checkBruteForce(lockIdentifier);

      const user = await getUserByEmailOrUsername(input.identifier);

      if (!user || !user.password) {
        recordFailedAttempt(lockIdentifier);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Credenciais inválidas",
        });
      }

      const isValid = await bcrypt.compare(input.password, user.password);

      if (!isValid) {
        recordFailedAttempt(lockIdentifier);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Credenciais inválidas",
        });
      }

      clearFailedAttempts(lockIdentifier);

      const token = jwt.sign(
        { userId: user.id },
        ENV.cookieSecret || "fallback-secret",
        { expiresIn: "7d" }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      };
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
        console.warn("SMTP credentials not configured. Token generated but not sent:", resetToken);
        return { success: true, warning: "SMTP not configured. Token logged in server console." };
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
