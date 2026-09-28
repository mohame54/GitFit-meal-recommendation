import { Agent } from "@mastra/core/agent";
import { feedbackExtractionPrompt } from "../prompts/feedback-ext.js";
import { parseEnv } from "../../env-parser.js";
import { feedbackExtractionSchema } from "./feedback-extraction-schema.js";

const env = parseEnv();

export { feedbackExtractionSchema };

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
