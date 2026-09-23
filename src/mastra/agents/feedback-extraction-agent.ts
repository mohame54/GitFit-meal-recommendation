import { Agent } from "@mastra/core/agent";
import { feedbackExtractionPrompt } from "../prompts/feedback-ext.js";
import { parseEnv } from "../../env-parser.js";
import { z } from "zod";

const env = parseEnv();

export const feedbackExtractionSchema = z.object({
  sentiment: z.enum(["positive", "negative", "mixed", "neutral"]),
  attributes: z.array(
    z.object({
      preference_type: z.enum([
        "cuisine",
        "ingredient",
        "spice_level",
        "meal_type",
        "prep_time",
        "texture",
      ]),
      value: z.string(),
      polarity: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    }),
  ),
});

export const feedbackExtractionAgent = new Agent({
  id: "feedback-extraction-agent",
  name: "Feedback Extraction Agent",
  description:
    "Extracts structured sentiment and preference attributes from free-text recipe feedback. " +
    "Use when you need to interpret comments like 'too salty' or 'loved the spice' into typed attributes.",
  instructions: `
${feedbackExtractionPrompt}
`,
  model: env.feedbackLLM.modelId,
});
