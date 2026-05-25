import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { ENV } from "./env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: { id: number; email?: string | null; username?: string | null; role: string } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user = null;

  const authHeader = opts.req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, ENV.cookieSecret || "fallback-secret") as { userId: number };
      const db = await getDb();
      if (db) {
        const result = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        if (result.length > 0) {
          user = {
            id: result[0].id,
            email: result[0].email,
            username: result[0].username,
            role: result[0].role,
          };
        }
      }
    } catch (e) {
      // Invalid token, leave user as null
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
