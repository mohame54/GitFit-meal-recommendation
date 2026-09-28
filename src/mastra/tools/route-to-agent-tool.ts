import { z } from "zod";
import { parseEnv } from "../../env-parser.js";
import { conversationStateService } from "../../services/conversation.js";
import { feedbackExtractionAgent } from "../agents/feedback-extraction-agent.js";
import { nutritionAgent } from "../agents/nutrition-agent.js";
import { onboardingAgent } from "../agents/onboarding-agent.js";
import { recipeGenerationAgent } from "../agents/recipe-generation-agent.js";
import { LLM_MAX_RETRIES } from "../agents/utils.js";
import type { AgentId } from "../conversation/types.js";
import { BaseTool } from "./base-tool.js";

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

const inputSchema = z.object({
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
      "Handoff prompt for the specialist (user intent and relevant conversation context). Do not include a user id.",
    ),
  reason: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Brief reason for choosing this specialist"),
});

const outputSchema = z.object({
  targetAgentId: z.enum(ROUTEABLE_AGENT_IDS),
  text: z.string(),
  reason: z.string().optional(),
});

const RouteToAgentDesc= `
Route the current user request to a specialist agent and return that agent's reply. 
Use this whenever onboarding, meal recommendations, feedback extraction, or recipe generation is needed. 
Pass a clear handoff message that includes any relevant context. Do not include a user id; specialist tools already run as the signed-in user.
`;

class RouteToAgentTool extends BaseTool<typeof inputSchema, typeof outputSchema> {
  readonly id = "route-to-agent";

  constructor() {
    super({
      description:RouteToAgentDesc,
      inputSchema,
      outputSchema,
      run: async ({ targetAgentId, message, reason }, actor, context) => {
        const env = parseEnv();
        const agent = SPECIALISTS[targetAgentId];
        const modelSettings = {
          temperature: env.LLM_TEMPERATURE ?? 0.0,
          maxOutputTokens: env.LLM_MAX_TOKENS ?? 1000,
          maxRetries: LLM_MAX_RETRIES,
        };

        const session = conversationStateService.getSession(actor.sessionId);

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
            requestContext: context.requestContext,
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
          const response = await agent.generate(message, {
            maxSteps: 5,
            modelSettings,
            requestContext: context.requestContext,
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
  }
}

export const routeToAgentTool = new RouteToAgentTool().tool;
