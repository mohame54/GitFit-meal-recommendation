import { getRecommendationsTool } from "./get-recommendations-tool.js";
import { submitFeedbackTool } from "./submit-feedback-tool.js";
import { generateRecipeTool } from "./generate-recipe-tool.js";
import { submitOnboardingTool } from "./submit-onboarding-tool.js";
import { updateProfileTool } from "./update-profile-tool.js";

/**
 * Single source of truth for every tool available to agents.
 * To extend the agent with a new capability:
 *   1. Create src/mastra/tools/your-new-tool.ts using createTool()
 *   2. Import and add it below
 * Nothing else needs to change — the agent picks up new tools automatically.
 *
 * Specialists may still use a subset (e.g. onboardingAgent only gets
 * submitOnboardingTool; mainRouterAgent only gets updateProfileTool).
 */
export const tools = {
  getRecommendationsTool,
  submitFeedbackTool,
  generateRecipeTool,
  submitOnboardingTool,
  updateProfileTool,
};
