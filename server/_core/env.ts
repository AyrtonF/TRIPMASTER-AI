export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  llmProvider: process.env.LLM_PROVIDER ?? "groq",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqApiKeys: (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
};

export function requireEnvValue(value: string | undefined | null, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}
