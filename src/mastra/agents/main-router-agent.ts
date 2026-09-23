import { Agent } from "@mastra/core/agent";
import { parseEnv } from "../../env-parser.js";
import { mainRouterPrompt } from "../prompts/main-router.js";
import { updateProfileTool } from "../tools/update-profile-tool.js";
import { feedbackExtractionAgent } from "./feedback-extraction-agent.js";
import { nutritionAgent } from "./nutrition-agent.js";
import { onboardingAgent } from "./onboarding-agent.js";
import { recipeGenerationAgent } from "./recipe-generation-agent.js";

const env = parseEnv();

/**
 * Supervisor agent: routes chat to specialized subagents and handles
 * confirmed profile updates directly via tools.
 */
export const mainRouterAgent = new Agent({
  id: "main-router-agent",
  name: "Main Router",
  description:
    "Primary chat entrypoint. Delegates to onboarding, nutrition, feedback, " +
    "and recipe specialists; updates profile only after explicit confirmation.",
  instructions: mainRouterPrompt,
  model: env.nutrientLLM.modelId,
  agents: {
    onboardingAgent,
    nutritionAgent,
    feedbackExtractionAgent,
    recipeGenerationAgent,
  },
  tools: {
    updateProfileTool,
  },
});
