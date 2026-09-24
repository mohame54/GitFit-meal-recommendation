import { Agent } from "@mastra/core/agent";
import { parseEnv } from "../../env-parser.js";
import { prompts } from "../prompts/index.js";

const env = parseEnv();

export const recipeGenerationAgent = new Agent({
  id: "recipe-generation-agent",
  name: "Recipe Generation Agent",
  description:
    "Generates a structured custom recipe JSON from constraints and preferences. " +
    "Prefer nutritionAgent's generate-recipe tool for end-user requests; use this specialist " +
    "when you need raw structured recipe generation.",
  instructions: `
${prompts.recipeGeneration}
`,
  model: env.recipeGenerationLLM.modelId,
});
