import { getRecommendationsTool } from "./get-recommendations-tool.js";
import { submitFeedbackTool } from "./submit-feedback-tool.js";
import { generateRecipeTool } from "./generate-recipe-tool.js";
import { submitOnboardingTool } from "./submit-onboarding-tool.js";
import { updateProfileTool } from "./update-profile-tool.js";

/**
 * Shared tools for specialist agents (e.g. nutritionAgent).
 * To extend:
 *   1. Create a class extending BaseTool, set `readonly id`, and pass schemas plus `run` to `super`
 *   2. Add that export below (or register it only on a specific agent)
 *   Server-side identity (userId and anything else on ToolActor) is injected
 *   by BaseTool; do not add those fields to the model-facing input schema.
 *
 * Note: route-to-agent is registered only on mainRouterAgent — do not add it
 * here, or you create a circular import with the specialist agents.
 *
 * Specialists may still use a subset (e.g. onboardingAgent only gets
 * submitOnboardingTool; mainRouterAgent gets routeToAgentTool + updateProfileTool).
 */
export const tools = {
  getRecommendationsTool,
  submitFeedbackTool,
  generateRecipeTool,
  submitOnboardingTool,
  updateProfileTool,
};
