import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { parseEnv } from "../../env-parser.js";
import { conversationStateService } from "../../services/conversation.js";
import { feedbackExtractionAgent } from "../agents/feedback-extraction-agent.js";
import { nutritionAgent } from "../agents/nutrition-agent.js";
import { onboardingAgent } from "../agents/onboarding-agent.js";
import { recipeGenerationAgent } from "../agents/recipe-generation-agent.js";
import type { AgentId } from "../conversation/types.js";

const ROUTEABLE_AGENT_IDS = [
  "onboarding-agent",
  "nutrition-agent",
  "feedback-extraction-agent",
  "recipe-generation-agent",
] as const;

type RouteableAgentId = (typeof ROUTEABLE_AGENT_IDS)[number];

const SPECIALISTS = {
  "onboarding-agent": onboardingAgent,
  "nutrition-agent": nutritionAgent,
  "feedback-extraction-agent": feedbackExtractionAgent,
  "recipe-generation-agent": recipeGenerationAgent,
} as const satisfies Record<RouteableAgentId, unknown>;

export const routeToAgentTool = createTool({
  id: "route-to-agent",
  description:
    "Route the current user request to a specialist agent and return that agent's reply. " +
    "Use this whenever onboarding, meal recommendations, feedback extraction, or recipe " +
    "generation is needed. Pass a clear handoff message that includes any relevant context.",
  inputSchema: z.object({
    targetAgentId: z
      .enum(ROUTEABLE_AGENT_IDS)
      .describe(
        "Specialist to invoke: onboarding-agent | nutrition-agent | " +
          "feedback-extraction-agent | recipe-generation-agent",
      ),
    message: z
      .string()
      .trim()
      .min(1)
      .describe(
        "Handoff prompt for the specialist (user intent + any needed context such as userId)",
      ),
    reason: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Brief reason for choosing this specialist"),
  }),
  outputSchema: z.object({
    targetAgentId: z.enum(ROUTEABLE_AGENT_IDS),
    text: z.string(),
    reason: z.string().optional(),
  }),
  execute: async ({ targetAgentId, message, reason }, context) => {
    const env = parseEnv();
    const agent = SPECIALISTS[targetAgentId];
    const modelSettings = {
      temperature: env.LLM_TEMPERATURE ?? 0.0,
      maxOutputTokens: env.LLM_MAX_TOKENS ?? 1000,
    };

    const sessionIdRaw = context.requestContext.getRaw("sessionId");
    const sessionId =
      typeof sessionIdRaw === "string" && sessionIdRaw.trim()
        ? sessionIdRaw.trim()
        : null;

    const session = sessionId
      ? conversationStateService.getSession(sessionId)
      : undefined;

    let text: string;

    if (session) {
      const started = conversationStateService.recordDelegationStart(session, {
        primitiveId: targetAgentId,
        primitiveType: "agent",
        prompt: message,
      });

      const stateForGenerate = started?.state ?? session;
      const specialistMessages = conversationStateService.buildAgentMessages(
        stateForGenerate,
        targetAgentId,
      ) as Parameters<typeof agent.generate>[0];

      const response = await agent.generate(specialistMessages, {
        maxSteps: 5,
        modelSettings,
      });
      text = response.text || "(no text returned)";

      conversationStateService.recordDelegationComplete(
        started?.state ?? stateForGenerate,
        {
          primitiveId: targetAgentId,
          primitiveType: "agent",
          text,
        },
      );
    } else {
      // Fallback when used outside the chat handler (no session context).
      const response = await agent.generate(message, {
        maxSteps: 5,
        modelSettings,
      });
      text = response.text || "(no text returned)";
    }

    return {
      targetAgentId: targetAgentId as AgentId & RouteableAgentId,
      text,
      ...(reason ? { reason } : {}),
    };
  },
});
