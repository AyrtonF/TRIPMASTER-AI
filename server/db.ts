import { eq, desc, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sessions, Session, InsertSession } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by Email or Username (for Local Auth)
 */
export async function getUserByEmailOrUsername(identifier: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUserLocal(user: InsertUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(users).values({
    ...user,
    lastSignedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return result[0].insertId;
}

export async function updateUserResetToken(userId: number, token: string | null, expiry: Date | null) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(users).set({
    resetToken: token,
    resetTokenExpiry: expiry,
    updatedAt: new Date()
  }).where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(users).set({
    password: passwordHash,
    updatedAt: new Date()
  }).where(eq(users.id, userId));
}

/**
 * Create a new travel planning session
 */
export async function createSession(
  userId: number,
  inputText: string
): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const sessionId = crypto.randomUUID();
  const now = new Date();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    inputText,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return sessionId;
}

/**
 * Get a session by ID
 */
export async function getSessionById(sessionId: string): Promise<Session | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: number): Promise<Session[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}

/**
 * Update session status and current agent
 */
export async function updateSessionStatus(
  sessionId: string,
  status: "pending" | "processing" | "completed" | "error",
  currentAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (currentAgent) {
    updateData.currentAgent = currentAgent;
  }

  if (status === "completed") {
    updateData.completedAt = new Date();
  }

  await db
    .update(sessions)
    .set(updateData)
    .where(eq(sessions.id, sessionId));
}

/**
 * Update session context (accumulated data from agents)
 */
export async function updateSessionContext(
  sessionId: string,
  context: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(sessions)
    .set({
      context,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Update session result (final travel plan)
 */
export async function updateSessionResult(
  sessionId: string,
  result: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(sessions)
    .set({
      result,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Update session error
 */
export async function updateSessionError(
  sessionId: string,
  errorMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(sessions)
    .set({
      status: "error",
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId));
}
