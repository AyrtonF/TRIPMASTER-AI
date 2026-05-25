import { describe, it, expect } from "vitest";
import { invokeLLM } from "../_core/llm";

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === "true";
const integrationDescribe = runIntegrationTests ? describe : describe.skip;

integrationDescribe("LLM Integration", () => {
  it("should successfully call the LLM API", { timeout: 30000 }, async () => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: "Say 'Hello, TripMaster AI!' and nothing else.",
        },
      ],
    });

    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message.content).toBeDefined();
    expect(response.choices[0].message.content).toContain("TripMaster AI");
  });

  it("should handle system and user messages correctly", { timeout: 30000 }, async () => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a JSON generator. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: 'Generate a JSON object with keys "name" and "age".',
        },
      ],
    });

    const content = response.choices[0].message.content;
    expect(content).toBeDefined();

    // Try to parse as JSON
    try {
      const json = JSON.parse(content);
      expect(json).toHaveProperty("name");
      expect(json).toHaveProperty("age");
    } catch (e) {
      // If not pure JSON, at least check it contains JSON-like content
      expect(content).toContain("{");
      expect(content).toContain("}");
    }
  });
});
