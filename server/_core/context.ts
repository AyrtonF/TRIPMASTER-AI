import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { ENV, requireEnvValue } from "./env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: { id: number; email?: string | null; username?: string | null; role: string } | null;
};

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return undefined;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user = null;

  const cookieToken = getCookieValue(opts.req.headers.cookie, COOKIE_NAME);
  const authHeader = opts.req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  const token = cookieToken ?? bearerToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, requireEnvValue(ENV.jwtSecret, "JWT_SECRET")) as { userId: number };
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
