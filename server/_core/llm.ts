import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  providerOverride?: "groq" | "gemini" | "auto";
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = (providerOverride?: "groq" | "gemini" | "auto") => {
  const provider = (providerOverride && providerOverride !== "auto") ? providerOverride : (ENV.llmProvider || "groq");
  if (provider === "groq") {
    return "https://api.groq.com/openai/v1/chat/completions";
  }
  if (provider === "gemini") {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
  // Fallback to Manus Forge API
  return ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
};

const assertApiKey = (providerOverride?: "groq" | "gemini" | "auto") => {
  const provider = (providerOverride && providerOverride !== "auto") ? providerOverride : (ENV.llmProvider || "groq");
  const key = provider === "groq" ? ENV.groqApiKey : provider === "gemini" ? ENV.geminiApiKey : ENV.forgeApiKey;
  if (!key) {
    // throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`); // Temporariamente silenciado para fallback
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const resolvedProvider = ((params.providerOverride && params.providerOverride !== "auto") ? params.providerOverride : (ENV.llmProvider === "auto" ? "gemini" : (ENV.llmProvider || "groq"))) as "groq" | "gemini" | "auto";

  let model = "gemini-2.5-flash";
  if (resolvedProvider === "groq") {
    model = "llama-3.3-70b-versatile";
  } else if (resolvedProvider === "gemini") {
    model = "gemini-2.5-flash"; // Volta para o Gemini 2.5 Flash conforme pedido
  }
  
  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  if (resolvedProvider === "gemini") {
    payload.max_tokens = 8192; // Max resources to avoid truncation on Gemini 2.5 Flash
  } else {
    payload.max_tokens = 4000; // Groq has a 12k TPM limit, and requested tokens = prompt + max_tokens
  }
  
  // Only add thinking for non-Groq providers
  if (resolvedProvider !== "groq" && resolvedProvider !== "gemini") {
    payload.thinking = {
      "budget_tokens": 128
    };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    // Avoid sending response_format for gemini to prevent native wrapper truncation bugs
    if (resolvedProvider !== "gemini") {
      payload.response_format = normalizedResponseFormat;
    }
  }

  const apiKey = resolvedProvider === "groq" ? ENV.groqApiKey : resolvedProvider === "gemini" ? ENV.geminiApiKey : ENV.forgeApiKey;

  const maxRetries = resolvedProvider === "groq" 
    ? (ENV.groqApiKeys && ENV.groqApiKeys.length > 0 ? ENV.groqApiKeys.length * 2 : 5) 
    : 1; // For Gemini/Forge, fail fast (no internal retries) so it can fallback immediately
  let attempt = 0;
  let delayMs = 2000; // Start with 2s
  let currentKeyIndex = 0;

  while (attempt < maxRetries) {
    let currentApiKey = apiKey;
    if (resolvedProvider === "groq" && ENV.groqApiKeys && ENV.groqApiKeys.length > 0) {
      currentApiKey = ENV.groqApiKeys[currentKeyIndex % ENV.groqApiKeys.length];
    }

    try {
      if (!currentApiKey) throw new Error("Chave API não configurada para " + resolvedProvider);
      
      const response = await fetch(resolveApiUrl(resolvedProvider), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${currentApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Se for Rate Limit
        if (response.status === 429) {
          throw new Error(`RateLimit: ${errorText}`);
        }
        
        throw new Error(
          `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
        );
      }

      return (await response.json()) as InvokeResult;
    } catch (error: any) {
      // Se for Rate Limit ou falha, vamos retentar.
      // E se for o Gemini que estourou, ele falha rápido para dar fallback.
      if (error.message.startsWith("RateLimit") && attempt < maxRetries - 1) {
        attempt++;
        
        let specificWaitMs = delayMs;
        const waitMatch = error.message.match(/Please try again in ([\d\.]+)s/);
        if (waitMatch && waitMatch[1]) {
          // Add 1.5s buffer to the exact wait time requested by Groq
          specificWaitMs = Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1500; 
        }
        
        // If using Groq, switch to the next key instead of just waiting
        if (resolvedProvider === "groq" && ENV.groqApiKeys && ENV.groqApiKeys.length > 1) {
          currentKeyIndex++;
          console.warn(`[invokeLLM] Rate limit hit. Switching to Groq API Key #${(currentKeyIndex % ENV.groqApiKeys.length) + 1} (Attempt ${attempt}/${maxRetries})...`);
          // Small delay before retrying with new key
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          const waitTime = Math.max(delayMs, specificWaitMs);
          console.warn(`[invokeLLM] Rate limit hit no ${resolvedProvider}. Retrying in ${waitTime}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          delayMs = waitTime * 2; // Exponential backoff
        }
      } else {
        throw error; // Repassa outros erros ou se acabarem as tentativas
      }
    }
  }
  
  throw new Error("Failed to invoke LLM after multiple retries");
}
