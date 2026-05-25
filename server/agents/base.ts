import fs from "fs/promises";
import path from "path";
import { invokeLLM } from "../_core/llm";
import { z } from "zod";

/**
 * Load a prompt from the prompts directory
 */
async function loadPrompt(agentName: string): Promise<string> {
  const promptPath = path.join(
    process.cwd(),
    "server",
    "agents",
    "prompts",
    `${agentName}.md`
  );

  try {
    const content = await fs.readFile(promptPath, "utf-8");
    return content;
  } catch (error) {
    throw new Error(`Failed to load prompt for agent "${agentName}": ${error}`);
  }
}

/**
 * Generic function to run an LLM agent
 * @param agentName - Name of the agent (used to load prompt file)
 * @param userInput - The user's input or context
 * @param context - Accumulated context from previous agents
 * @param schema - Optional Zod schema to validate structured JSON output
 * @returns The agent's response as a string, or parsed structured data if schema is provided
 */
export async function runAgent<T = string>(
  agentName: string,
  userInput: string,
  context: string = "",
  schema?: z.ZodType<T>
): Promise<T> {
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Load the system prompt for this agent
      const systemPrompt = await loadPrompt(agentName);

      // Build the user message with context if available
      let userMessage = userInput;
      if (context) {
        userMessage = `${context}\n\n---\n\nNow, ${userInput}`;
      }

      // Se for uma tentativa de retry, avisa a IA para não cortar
      if (attempt > 1) {
        userMessage += `\n\nATENÇÃO: Sua resposta anterior foi cortada e o JSON ficou inválido. Por favor, certifique-se de retornar o JSON completo e fechado corretamente com chaves.`;
      }

      // Se for a primeira tentativa e LLM_PROVIDER for auto, tenta gemini. Se falhar, vai pro groq nas próximas!
      const currentProvider = attempt === 1 ? undefined : "groq";

      // Call the LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage as string },
        ],
        responseFormat: schema ? { type: "json_object" } : undefined,
        providerOverride: currentProvider,
      });

      // Extract the response content
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`No response from LLM for agent "${agentName}"`);
      }

      // Ensure content is a string
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      
      if (schema) {
        try {
          // Find JSON block
          const jsonMatch = contentStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.error(`[runAgent] ERROR: No JSON found on attempt ${attempt}. Raw output from ${agentName}:`, contentStr);
            throw new Error("No JSON structure found in response");
          }
          const parsedJSON = JSON.parse(jsonMatch[0]);
          // Validate with Zod
          return schema.parse(parsedJSON);
        } catch (parseError) {
          console.error(`[runAgent] Parse error for ${agentName} on attempt ${attempt}:`, parseError);
          throw parseError; // Caught by the outer try-catch for retry
        }
      }

      return contentStr as unknown as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[runAgent] Agent "${agentName}" failed attempt ${attempt}/${maxRetries}. Retrying...`);
    }
  }

  throw new Error(`Agent "${agentName}" failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Legacy Parse JSON response (Use runAgent with schema instead)
 */
export function parseAgentJSON(response: string): Record<string, unknown> {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in agent response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse agent JSON response: ${error}`);
  }
}
