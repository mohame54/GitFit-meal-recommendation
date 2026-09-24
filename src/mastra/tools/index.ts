import { getRecommendationsTool } from "./get-recommendations-tool.js";
import { submitFeedbackTool } from "./submit-feedback-tool.js";
import { generateRecipeTool } from "./generate-recipe-tool.js";
import { submitOnboardingTool } from "./submit-onboarding-tool.js";
import { updateProfileTool } from "./update-profile-tool.js";

/**
 * Shared tools for specialist agents (e.g. nutritionAgent).
 * To extend:
 *   1. Create src/mastra/tools/your-new-tool.ts using createTool()
 *   2. Import and add it below (or register only on a specific agent)
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
