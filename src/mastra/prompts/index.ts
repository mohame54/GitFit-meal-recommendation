import { feedbackExtractionPrompt } from "./feedback-ext.js";
import { mainRouterPrompt } from "./main-router.js";
import { nutritionAgentPrompt } from "./nutrition-agent.js";
import { onboardingAgentPrompt } from "./onboarding-agent.js";
import { recipeGenerationPrompt } from "./recipe-generation.js";

export const prompts = {
  mainRouter: mainRouterPrompt,
  nutritionAgent: nutritionAgentPrompt,
  onboardingAgent: onboardingAgentPrompt,
  feedbackExtraction: feedbackExtractionPrompt,
  recipeGeneration: recipeGenerationPrompt,
};
