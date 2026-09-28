import { Agent } from "@mastra/core/agent";
import { parseEnv } from "../../env-parser.js";
import { onboardingAgentPrompt } from "../prompts/onboarding-agent.js";
import { submitOnboardingTool } from "../tools/submit-onboarding-tool.js";
import { updateProfileTool } from "../tools/update-profile-tool.js";

const env = parseEnv();

export const onboardingAgent = new Agent({
  id: "onboarding-agent",
  name: "Onboarding Agent",
  description:
    "Guides new users through a 4-step skippable onboarding wizard " +
    "(diet, allergies, cuisines, meal types), saves results when they finish, " +
    "then offers an optional profile update only after explicit confirmation. " +
    "Use when the user is new, wants to set preferences, or complete onboarding.",
  instructions: onboardingAgentPrompt,
  model: env.onboardingAgentLLM.modelId,
  tools: {
    submitOnboardingTool,
    updateProfileTool,
  },
});
