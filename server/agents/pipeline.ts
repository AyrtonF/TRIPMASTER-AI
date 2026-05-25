import { runAgent } from "./base";
import {
  updateSessionStatus,
  updateSessionContext,
  updateSessionResult,
  updateSessionError,
} from "../db";
import { z } from "zod";
import { PipelineContext, buildContextString } from "./utils";

/**
 * Execute the pipeline of 8 agents.
 * Independent agents are run in parallel to reduce processing time.
 */
export async function executePipeline(
  sessionId: string,
  userInput: string
): Promise<void> {
  const context: PipelineContext = {};
  
  // Generic JSON schema to force structured outputs without redefining all fields
  const jsonSchema = z.record(z.string(), z.any());

  try {
    // 1. Orchestrator
    await updateSessionStatus(sessionId, "processing", "orchestrator");
    context.orchestrator = await runAgent("orchestrator", userInput);
    await updateSessionContext(sessionId, context);

    // 2. Profile
    await updateSessionStatus(sessionId, "processing", "profile");
    context.profile = await runAgent("profile", userInput, context.orchestrator, jsonSchema);
    await updateSessionContext(sessionId, context);

    // 3. Destinations
    await updateSessionStatus(sessionId, "processing", "destinations");
    const destContext = `User Profile:\n${JSON.stringify(context.profile)}`;
    context.destinations = await runAgent("destinations", userInput, destContext, jsonSchema);
    await updateSessionContext(sessionId, context);

    // 4. Sequential Execution: Transport, Accommodation, Experiences
    // These used to run in parallel, but causing massive Token Per Minute (TPM) spikes on free tier LLMs
    // Running sequentially prevents the 429 Payload Too Large / Rate Limit errors
    await updateSessionStatus(sessionId, "processing", "transport");
    const parallelContext = `User Profile:\n${JSON.stringify(context.profile)}\n\nDestination Options:\n${JSON.stringify(context.destinations)}`;
    
    const transport = await runAgent("transport", userInput, parallelContext, jsonSchema);
    context.transport = transport;
    await updateSessionContext(sessionId, context);

    await updateSessionStatus(sessionId, "processing", "accommodation");
    const accommodation = await runAgent("accommodation", userInput, parallelContext, jsonSchema);
    context.accommodation = accommodation;
    await updateSessionContext(sessionId, context);

    await updateSessionStatus(sessionId, "processing", "experiences");
    const experiences = await runAgent("experiences", userInput, parallelContext, jsonSchema);
    context.experiences = experiences;
    await updateSessionContext(sessionId, context);

    // 5. Financial
    // Financial needs transport, accommodation and experiences costs
    await updateSessionStatus(sessionId, "processing", "financial");
    const financialContext = `Budget: ${context.profile?.budget_brl}\nTransport Costs:\n${JSON.stringify(context.transport)}\nAccommodation Costs:\n${JSON.stringify(context.accommodation)}\nExperiences Costs:\n${JSON.stringify(context.experiences)}`;
    context.financial = await runAgent("financial", userInput, financialContext, jsonSchema);
    await updateSessionContext(sessionId, context);

    // 6. Presentation
    // Presentation needs everything to build the final markdown
    await updateSessionStatus(sessionId, "processing", "presentation");
    const finalContext = buildContextString(context);
    context.presentation = await runAgent("presentation", userInput, finalContext);
    await updateSessionContext(sessionId, context);

    // Finalize
    await updateSessionResult(sessionId, context.presentation || "");
    await updateSessionStatus(sessionId, "completed");

    // TODO: Send notification to owner with destination and budget
  } catch (error) {
    // Handle errors from agents
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateSessionError(sessionId, errorMessage);
    throw error;
  }
}
