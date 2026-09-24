import { Agent } from "@mastra/core/agent";
import { parseEnv } from "../../env-parser.js";
import { mainRouterPrompt } from "../prompts/main-router.js";
import { routeToAgentTool } from "../tools/route-to-agent-tool.js";
import { updateProfileTool } from "../tools/update-profile-tool.js";

const env = parseEnv();

/**
 * Supervisor agent: routes chat to specialized subagents via route-to-agent
 * and handles confirmed profile updates directly via tools.
 */
export const mainRouterAgent = new Agent({
  id: "main-router-agent",
  name: "Main Router",
  description:
    "Primary chat entrypoint. Delegates to onboarding, nutrition, feedback, " +
    "and recipe specialists via route-to-agent; updates profile only after explicit confirmation.",
  instructions: mainRouterPrompt,
  model: env.mainAgentLLM.modelId,
  tools: {
    routeToAgentTool,
    updateProfileTool,
  },
});
