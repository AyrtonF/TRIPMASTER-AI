export interface PipelineContext {
  orchestrator?: string;
  profile?: Record<string, unknown>;
  destinations?: Record<string, unknown>;
  transport?: Record<string, unknown>;
  accommodation?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  experiences?: Record<string, unknown>;
  presentation?: string;
}

/**
 * Build a context string from accumulated agent responses
 * This is passed to the next agent for context
 */
export function buildContextString(context: PipelineContext): string {
  const parts: string[] = [];

  if (context.orchestrator) {
    parts.push(`## Orchestrator Output\n${context.orchestrator}`);
  }

  if (context.profile) {
    parts.push(`## User Profile\n${JSON.stringify(context.profile, null, 2)}`);
  }

  if (context.destinations) {
    parts.push(
      `## Destination Recommendations\n${JSON.stringify(context.destinations, null, 2)}`
    );
  }

  if (context.transport) {
    parts.push(
      `## Transport Options\n${JSON.stringify(context.transport, null, 2)}`
    );
  }

  if (context.accommodation) {
    parts.push(
      `## Accommodation Options\n${JSON.stringify(context.accommodation, null, 2)}`
    );
  }

  if (context.financial) {
    parts.push(
      `## Financial Summary\n${JSON.stringify(context.financial, null, 2)}`
    );
  }

  if (context.experiences) {
    parts.push(
      `## Experiences & Itinerary\n${JSON.stringify(context.experiences, null, 2)}`
    );
  }

  return parts.join("\n\n");
}

/**
 * Calculate progress percentage based on current agent
 */
export function calculateProgress(currentAgent: string | null): number {
  if (!currentAgent) return 0;
  
  if (currentAgent === "orchestrator") return 10;
  if (currentAgent === "profile") return 25;
  if (currentAgent === "destinations") return 40;
  if (currentAgent === "transport") return 50;
  if (currentAgent === "accommodation") return 60;
  if (currentAgent === "experiences") return 70;
  if (currentAgent === "financial") return 85;
  if (currentAgent === "presentation") return 95;
  
  return 100;
}
