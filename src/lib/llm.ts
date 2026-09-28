import { feedbackExtractionAgent } from "../mastra/agents/feedback-extraction-agent.js";
import { feedbackExtractionSchema } from "../mastra/agents/feedback-extraction-schema.js";
import { LLM_MAX_RETRIES } from "../mastra/agents/utils.js";
import { parseEnv } from "../env-parser.js";

/**
 * Extracts structured preference signal from a free-text feedback comment.
 * Returns raw parsed JSON — caller is responsible for validating it
 * (see feedback.ts:validateExtraction) before trusting any of it.
 */
export async function extractFeedbackSignal(comment: string): Promise<unknown> {
  const env = parseEnv();
  const response = await feedbackExtractionAgent.generate(comment, {
    maxSteps: 1,
    modelSettings: {
      temperature: env.LLM_TEMPERATURE ?? 0,
      maxOutputTokens: env.LLM_MAX_TOKENS ?? 500,
      maxRetries: LLM_MAX_RETRIES,
    },
    structuredOutput: {
      schema: feedbackExtractionSchema,
      jsonPromptInjection: "auto",
    },
  });

  const parsed = feedbackExtractionSchema.safeParse(response.object);
  return parsed.success ? parsed.data : response.object;
}
