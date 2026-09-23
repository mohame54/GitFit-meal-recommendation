import { config } from "dotenv";
import { z } from "zod";
import { NodeEnv, LogLevel, LLMProvider } from "./types/enums.js";
import { resolveLLM } from "./lib/llm-config.js";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.nativeEnum(NodeEnv).default(NodeEnv.DEVELOPMENT),
  LOG_LEVEL: z.nativeEnum(LogLevel).optional(),
  /** Optional override when model name alone is ambiguous (e.g. Azure). */
  LLM_PROVIDER: z.nativeEnum(LLMProvider).optional(),
  NUTRIENT_LLM_NAME: z.string().trim().min(1),
  FEEDBACK_LLM_NAME: z.string().trim().min(1),
  GENERATION_LLM_NAME: z.string().trim().min(1).optional(),
  LLM_TEMPERATURE: z.coerce.number().optional(),
  LLM_MAX_TOKENS: z.coerce.number().optional(),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /**
   * When set, every request (except /health and OpenAPI UI) must send
   * matching X-Api-Key. Leave unset for local demos.
   */
  API_KEY: z.string().trim().min(1).optional(),
  /**
   * Only required for Spoonacular ingestion endpoints/scripts.
   * Runtime recommendations read from the local Postgres cache.
   */
  SPOONACULAR_API_KEY: z.string().trim().min(1).optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  nutrientLLM: ReturnType<typeof resolveLLM>;
  feedbackLLM: ReturnType<typeof resolveLLM>;
  generationLLM: ReturnType<typeof resolveLLM>;
};

let cached: AppConfig | null = null;

export function parseEnv(): AppConfig {
  if (cached) return cached;

  config();

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Error parsing environment variables:", parsed.error.format());
    process.exit(1);
  }

  const data = parsed.data;

  try {
    const nutrientLLM = resolveLLM(data.NUTRIENT_LLM_NAME, data.LLM_PROVIDER);
    const feedbackLLM = resolveLLM(data.FEEDBACK_LLM_NAME, data.LLM_PROVIDER);
    const generationLLM = resolveLLM(
      data.GENERATION_LLM_NAME ?? data.NUTRIENT_LLM_NAME,
      data.LLM_PROVIDER,
    );

    cached = {
      ...data,
      nutrientLLM,
      feedbackLLM,
      generationLLM,
    };
    return cached;
  } catch (err) {
    console.error(
      "Error resolving LLM provider / API key:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
}

/** Test helper — clears the singleton so a new env can be loaded. */
export function resetEnvCache(): void {
  cached = null;
}
