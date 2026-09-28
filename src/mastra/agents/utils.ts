/** Retries after the first call when Gemini returns a retryable error such as 503. */
export const LLM_MAX_RETRIES = 4;

export {
  ensureProviderApiKeyEnv,
  inferProviderFromModelName,
  resolveLLM,
  type ResolvedLLM,
} from "../../lib/llm-config.js";
