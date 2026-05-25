import { describe, it, expect, beforeAll } from "vitest";
import {
  createSession,
  getSessionById,
  updateSessionStatus,
  updateSessionContext,
  updateSessionResult,
} from "./db";

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === "true";
const integrationDescribe = runIntegrationTests ? describe : describe.skip;

integrationDescribe("Integration Tests", () => {
  let testSessionId: string;

  beforeAll(async () => {
    // Create a test session
    testSessionId = await createSession(
      1,
      "Quero viajar com minha família para o Nordeste em julho"
    );
  });

  it("should create a session", async () => {
    const session = await getSessionById(testSessionId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(testSessionId);
    expect(session?.status).toBe("pending");
    expect(session?.userId).toBe(1);
  });

  it("should update session status to processing", async () => {
    await updateSessionStatus(testSessionId, "processing", "orchestrator");
    const session = await getSessionById(testSessionId);
    expect(session?.status).toBe("processing");
    expect(session?.currentAgent).toBe("orchestrator");
  });

  it("should update session context", async () => {
    const context = {
      orchestrator: "Test orchestrator output",
      profile: { destination: "Nordeste", budget: 6000 },
    };
    await updateSessionContext(testSessionId, context);
    const session = await getSessionById(testSessionId);
    expect(session?.context).toBeDefined();
  });

  it("should update session result", async () => {
    const result = "# Plano de Viagem\n\nDestino: Nordeste\nOrçamento: R$ 6.000";
    await updateSessionResult(testSessionId, result);
    const session = await getSessionById(testSessionId);
    expect(session?.result).toBe(result);
  });

  it("should update session status to completed", async () => {
    await updateSessionStatus(testSessionId, "completed");
    const session = await getSessionById(testSessionId);
    expect(session?.status).toBe("completed");
    expect(session?.completedAt).toBeDefined();
  });
});
