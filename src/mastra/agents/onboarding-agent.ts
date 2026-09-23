import { Agent } from "@mastra/core/agent";
import { parseEnv } from "../../env-parser.js";
import { onboardingAgentPrompt } from "../prompts/onboarding-agent.js";
import { submitOnboardingTool } from "../tools/submit-onboarding-tool.js";

const env = parseEnv();

export const onboardingAgent = new Agent({
  id: "onboarding-agent",
  name: "Onboarding Agent",
  description:
    "Guides new users through a 4-step skippable onboarding wizard " +
    "(diet, allergies, cuisines, meal types) and saves results when they finish. " +
    "Use when the user is new, wants to set preferences, or complete onboarding.",
  instructions: onboardingAgentPrompt,
  model: env.nutrientLLM.modelId,
  tools: {
    submitOnboardingTool,
  },
});
