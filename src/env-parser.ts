import { config } from "dotenv";
import { z } from "zod";
import { NodeEnv, LogLevel, LLMProvider } from "./types/enums.js";
import { resolveLLM } from "./lib/llm-config.js";

/** Docker and Cloud Run set NODE_ENV=production; this app stores prod | dev. */
function normalizeNodeEnv(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return NodeEnv.DEVELOPMENT;
  }
  if (typeof value !== "string") return value;

  switch (value.trim().toLowerCase()) {
    case "production":
    case "prod":
      return NodeEnv.PRODUCTION;
    case "development":
    case "dev":
      return NodeEnv.DEVELOPMENT;
    default:
      return value;
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.preprocess(normalizeNodeEnv, z.nativeEnum(NodeEnv)),
  LOG_LEVEL: z.nativeEnum(LogLevel).optional(),
  /** Optional override when model name alone is ambiguous (e.g. Azure). */
  LLM_PROVIDER: z.nativeEnum(LLMProvider).optional(),
  NUTRIENT_LLM_NAME: z.string().trim().min(1),
  FEEDBACK_LLM_NAME: z.string().trim().min(1),
  MAIN_AGENT_LLM_NAME: z.string().trim().min(1),
  ONBOARDING_AGENT_LLM_NAME: z.string().trim().min(1),
  RECIPE_GENERATION_LLM_NAME: z.string().trim().min(1),
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
  recipeGenerationLLM: ReturnType<typeof resolveLLM>;
  mainAgentLLM: ReturnType<typeof resolveLLM>;
  onboardingAgentLLM: ReturnType<typeof resolveLLM>;
};

let cached: AppConfig | null = null;

export function parseEnv(): AppConfig {
  if (cached) return cached;

  config();

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    console.error(`Error parsing environment variables:\n${details}`);
    process.exit(1);
  }

  const data = parsed.data;

  try {
    const nutrientLLM = resolveLLM(data.NUTRIENT_LLM_NAME, data.LLM_PROVIDER);
    const feedbackLLM = resolveLLM(data.FEEDBACK_LLM_NAME, data.LLM_PROVIDER);
    const recipeGenerationLLM = resolveLLM(
      data.GENERATION_LLM_NAME ?? data.NUTRIENT_LLM_NAME,
      data.LLM_PROVIDER,
    );
    const mainAgentLLM = resolveLLM(
      data.MAIN_AGENT_LLM_NAME ?? data.GENERATION_LLM_NAME,
      data.LLM_PROVIDER,
    );
    const onboardingAgentLLM = resolveLLM(
      data.ONBOARDING_AGENT_LLM_NAME ?? data.GENERATION_LLM_NAME,
      data.LLM_PROVIDER,
    );

    cached = {
      ...data,
      nutrientLLM,
      feedbackLLM,
      recipeGenerationLLM,
      mainAgentLLM,
      onboardingAgentLLM,
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
