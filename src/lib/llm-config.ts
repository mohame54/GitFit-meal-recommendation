import { LLMProvider } from "../types/enums.js";

/** Env vars Mastra reads for each provider, plus common aliases we normalize. */
const PROVIDER_API_KEY_ENV: Record<LLMProvider, readonly string[]> = {
  [LLMProvider.GOOGLE]: [
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
  ],
  [LLMProvider.OPENAI]: ["OPENAI_API_KEY"],
  [LLMProvider.ANTHROPIC]: ["ANTHROPIC_API_KEY"],
  [LLMProvider.AZURE]: ["AZURE_API_KEY", "AZURE_OPENAI_API_KEY"],
  [LLMProvider.COHERE]: ["COHERE_API_KEY"],
  [LLMProvider.DEEPSEEK]: ["DEEPSEEK_API_KEY"],
};

/** Canonical env var Mastra looks up first for that provider. */
const PROVIDER_PRIMARY_API_KEY_ENV: Record<LLMProvider, string> = {
  [LLMProvider.GOOGLE]: "GOOGLE_API_KEY",
  [LLMProvider.OPENAI]: "OPENAI_API_KEY",
  [LLMProvider.ANTHROPIC]: "ANTHROPIC_API_KEY",
  [LLMProvider.AZURE]: "AZURE_API_KEY",
  [LLMProvider.COHERE]: "COHERE_API_KEY",
  [LLMProvider.DEEPSEEK]: "DEEPSEEK_API_KEY",
};

const KNOWN_PROVIDERS = new Set<string>(Object.values(LLMProvider));

export type ResolvedLLM = {
  provider: LLMProvider;
  modelName: string;
  /** Mastra `provider/model` string */
  modelId: string;
  apiKeyEnv: string;
  apiKey: string;
};

/**
 * Infer provider from a bare model name (e.g. gemini-2.5-flash → google).
 * Falls back to `override` when patterns don't match.
 */
export function inferProviderFromModelName(
  modelName: string,
  override?: LLMProvider,
): LLMProvider {
  const name = modelName.trim().toLowerCase();

  if (
    name.startsWith("gemini") ||
    name.startsWith("gemma") ||
    name.includes("google")
  ) {
    return LLMProvider.GOOGLE;
  }
  if (
    name.startsWith("gpt") ||
    name.startsWith("o1") ||
    name.startsWith("o3") ||
    name.startsWith("o4") ||
    name.startsWith("chatgpt") ||
    name.startsWith("text-embedding")
  ) {
    return LLMProvider.OPENAI;
  }
  if (name.startsWith("claude")) {
    return LLMProvider.ANTHROPIC;
  }
  if (name.startsWith("command") || name.startsWith("embed-")) {
    return LLMProvider.COHERE;
  }
  if (name.startsWith("deepseek")) {
    return LLMProvider.DEEPSEEK;
  }
  if (name.includes("azure")) {
    return LLMProvider.AZURE;
  }

  if (override) {
    return override;
  }

  throw new Error(
    `Cannot infer LLM provider from model name "${modelName}". ` +
      `Use a known prefix (gemini, gpt, claude, …), pass provider/model ` +
      `(e.g. google/gemini-2.5-flash), or set LLM_PROVIDER.`,
  );
}

function parseModelInput(raw: string): { provider?: LLMProvider; modelName: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("LLM model name is required.");
  }

  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return { modelName: trimmed };
  }

  const prefix = trimmed.slice(0, slash).toLowerCase();
  const modelName = trimmed.slice(slash + 1).trim();
  if (!modelName) {
    throw new Error(`Invalid model id "${raw}": missing model name after "/".`);
  }

  if (KNOWN_PROVIDERS.has(prefix)) {
    return { provider: prefix as LLMProvider, modelName };
  }

  return { modelName: trimmed };
}

function findApiKey(provider: LLMProvider): { envName: string; value: string } | null {
  for (const envName of PROVIDER_API_KEY_ENV[provider]) {
    const value = process.env[envName]?.trim();
    if (value) {
      return { envName, value };
    }
  }
  return null;
}

/**
 * Ensure Mastra can see the key under its primary env var name
 * (e.g. map GEMINI_API_KEY → GOOGLE_API_KEY).
 */
export function ensureProviderApiKeyEnv(provider: LLMProvider, apiKey: string): string {
  const primary = PROVIDER_PRIMARY_API_KEY_ENV[provider];
  if (!process.env[primary]?.trim()) {
    process.env[primary] = apiKey;
  }
  return primary;
}

/**
 * Resolve a model string into a Mastra model id + validated API key.
 * Accepts `gemini-2.5-flash` or `google/gemini-2.5-flash`.
 */
export function resolveLLM(
  rawModel: string,
  providerOverride?: LLMProvider,
): ResolvedLLM {
  const parsed = parseModelInput(rawModel);
  const provider =
    parsed.provider ?? inferProviderFromModelName(parsed.modelName, providerOverride);

  const found = findApiKey(provider);
  if (!found) {
    const tried = PROVIDER_API_KEY_ENV[provider].join(" / ");
    throw new Error(
      `No API key found for provider "${provider}" (model "${parsed.modelName}"). ` +
        `Set one of: ${tried}`,
    );
  }

  const apiKeyEnv = ensureProviderApiKeyEnv(provider, found.value);

  return {
    provider,
    modelName: parsed.modelName,
    modelId: `${provider}/${parsed.modelName}`,
    apiKeyEnv,
    apiKey: found.value,
  };
}
