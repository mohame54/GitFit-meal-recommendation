import { Mastra } from "@mastra/core";
import { feedbackExtractionAgent } from "./agents/feedback-extraction-agent.js";
import { mainRouterAgent } from "./agents/main-router-agent.js";
import { nutritionAgent } from "./agents/nutrition-agent.js";
import { onboardingAgent } from "./agents/onboarding-agent.js";
import { recipeGenerationAgent } from "./agents/recipe-generation-agent.js";
import { onboardingWorkflow } from "./workflows/onboarding-workflow.js";

/**
 * Register every agent and workflow here.
 */
export const mastra = new Mastra({
  agents: {
    mainRouterAgent,
    nutritionAgent,
    feedbackExtractionAgent,
    recipeGenerationAgent,
    onboardingAgent,
  },
  workflows: {
    onboardingWorkflow,
  },
});
