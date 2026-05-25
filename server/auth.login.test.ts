import { describe, expect, it, vi } from "vitest";

const cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

vi.mock("./db", () => ({
  getUserByEmailOrUsername: vi.fn(async () => ({
    id: 7,
    email: "sample@example.com",
    username: "sample",
    password: "hashed-password",
    role: "user",
  })),
  getLoginAttempt: vi.fn(async () => undefined),
  upsertLoginAttempt: vi.fn(async () => undefined),
  clearLoginAttempt: vi.fn(async () => undefined),
  createUserLocal: vi.fn(async () => 7),
  updateUserPassword: vi.fn(async () => undefined),
  updateUserResetToken: vi.fn(async () => undefined),
  getUserByResetToken: vi.fn(async () => undefined),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async () => true),
    hash: vi.fn(async () => "hashed-password"),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    appId: "tripmaster-local",
    jwtSecret: "test-secret",
    databaseUrl: "postgresql://tripmaster:tripmaster@localhost:5432/tripmaster",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
    llmProvider: "auto",
    groqApiKey: "",
    groqApiKeys: [],
    geminiApiKey: "",
  },
  requireEnvValue: (value: string, name: string) => {
    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  },
}));

const { appRouter } = await import("./routers");

describe("auth.login", () => {
  it("sets an HttpOnly session cookie and returns the authenticated user", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {
        protocol: "https",
        headers: {},
      },
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookieCalls.push({ name, value, options });
        },
      },
    } as never);

    const result = await caller.auth.login({
      identifier: "sample@example.com",
      password: "secret",
    });

    expect(result.user).toEqual({
      id: 7,
      email: "sample@example.com",
      username: "sample",
      role: "user",
    });
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]?.name).toBe("app_session_id");
    expect(cookieCalls[0]?.value).toEqual(expect.any(String));
    expect(cookieCalls[0]?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
  });
});