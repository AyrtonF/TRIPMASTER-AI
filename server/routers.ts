import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSession,
  getSessionById,
  getUserSessions,
} from "./db";
import { calculateProgress } from "./agents/pipeline";
import { authRouter } from "./routers/authRouter";
import { TRPCError } from "@trpc/server";

function failWithInternalError(message: string, scope: string, error: unknown): never {
  console.error(`[${scope}]`, error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,

  sessions: router({
    /**
     * Create a new travel planning session
     * Starts the pipeline of 8 agents
     */
    create: protectedProcedure
      .input(
        z.object({
          inputText: z.string().min(10, "Input must be at least 10 characters"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const sessionId = await createSession(ctx.user.id, input.inputText);

          return {
            sessionId,
            status: "pending",
            createdAt: new Date(),
          };
        } catch (error) {
          failWithInternalError("Falha ao criar sessão.", "sessions.create", error);
        }
      }),

    /**
     * Get a specific session by ID
     * Returns status and result if completed
     */
    get: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        try {
          const session = await getSessionById(input.sessionId);

          if (!session) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
          }

          if (session.userId !== ctx.user.id) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso não autorizado." });
          }

          const progress = session.status === "completed" ? 100 : calculateProgress(session.currentAgent);

          return {
            sessionId: session.id,
            status: session.status,
            currentAgent: session.currentAgent,
            progress: progress,
            result: session.result,
            errorMessage: session.errorMessage,
            createdAt: session.createdAt,
            completedAt: session.completedAt,
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }

          failWithInternalError("Falha ao obter sessão.", "sessions.get", error);
        }
      }),

    /**
     * List all sessions
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const sessions = await getUserSessions(ctx.user.id);

        return sessions.map((session) => ({
          sessionId: session.id,
          inputText: session.inputText,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          hasResult: !!session.result,
        }));
      } catch (error) {
        failWithInternalError("Falha ao listar sessões.", "sessions.list", error);
      }
    }),

    /**
     * Delete a session
     */
    delete: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const session = await getSessionById(input.sessionId);
          if (!session) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
          }
          if (session.userId !== ctx.user.id) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso não autorizado." });
          }

          const { deleteSession } = await import("./db");
          await deleteSession(input.sessionId);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }

          failWithInternalError("Falha ao excluir sessão.", "sessions.delete", error);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
