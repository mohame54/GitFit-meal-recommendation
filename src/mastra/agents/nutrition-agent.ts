import { Agent } from "@mastra/core/agent";
import { tools } from "../tools/index.js";
import { nutritionAgentPrompt } from "../prompts/nutrition-agent.js";
import { parseEnv } from "../../env-parser.js";

/**
 * The agent's job is narrow by design: understand what the user is asking
 * for in natural language, call the right tool(s), and present the result
 * conversationally. It does not do its own filtering, scoring, or preference
 * math — that logic lives in services/*.ts and is called through tools.
 */

const env = parseEnv();

export const nutritionAgent = new Agent({
  id: "nutrition-agent",
  name: "Nutrition Assistant",
  description:
    "Personalized meal recommendations, feedback recording, and custom recipe generation " +
    "via tools. Use when the user asks what to eat, wants meal ideas, reacts to a recipe, " +
    "or wants catalog-based suggestions.",
  instructions: `
${nutritionAgentPrompt}
`,
  model: env.nutrientLLM.modelId,
  tools,
});
