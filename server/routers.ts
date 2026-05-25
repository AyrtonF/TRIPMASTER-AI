import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSession,
  getSessionById,
  getUserSessions,
} from "./db";
import { executePipeline } from "./agents/pipeline";
import { calculateProgress } from "./agents/utils";
import { authRouter } from "./routers/authRouter";
import { TRPCError } from "@trpc/server";

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
          // Create session in database using authenticated user
          const sessionId = await createSession(ctx.user.id, input.inputText);

          // Start the pipeline asynchronously (don't wait for it)
          executePipeline(sessionId, input.inputText).catch((error) => {
            console.error(`[Pipeline Error] Session ${sessionId}:`, error);
          });

          return {
            sessionId,
            status: "pending",
            createdAt: new Date(),
          };
        } catch (error) {
          throw new Error(`Failed to create session: ${error}`);
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
            throw new Error("Session not found");
          }

          if (session.userId !== ctx.user.id) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized session access" });
          }

          // Calculate progress
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
          throw new Error(`Failed to get session: ${error}`);
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
        throw new Error(`Failed to list sessions: ${error}`);
      }
    }),

    /**
     * Delete a session
     */
    delete: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Verify session exists and belongs to user
          const session = await getSessionById(input.sessionId);
          if (!session) {
            throw new Error("Session not found");
          }
          if (session.userId !== ctx.user.id) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
          }

          const { deleteSession } = await import("./db");
          await deleteSession(input.sessionId);
          return { success: true };
        } catch (error) {
          throw new Error(`Failed to delete session: ${error}`);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
