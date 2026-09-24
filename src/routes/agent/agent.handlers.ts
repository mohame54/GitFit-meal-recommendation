import { RequestContext } from "@mastra/core/request-context";
import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import { parseEnv } from "../../env-parser.js";
import { mastra } from "../../mastra/index.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import {
  ConversationSessionUserMismatchError,
  ConversationSessionUserRequiredError,
  conversationStateService,
  inferSpecialistFromToolCalls,
} from "../../services/conversation.js";
import { ChatRoute } from "./agent.routes.js";
import type { ChatMessage, ChatSuccessResponseBody } from "./agent.schemas.js";
import type { ConversationState } from "../../mastra/conversation/types.js";

function latestUserContent(body: {
  message?: string;
  messages?: ChatMessage[];
}): string {
  if ("message" in body && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }
  const messages = body.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content;
  }
  throw new Error("No user message found in request");
}

export const chatHandler: ApiRouterHandler<typeof ChatRoute> = async (c) => {
  const body = c.req.valid("json");
  const env = parseEnv();

  let userId: string | undefined;
  try {
    const headerUserId = c.get("userId");
    const bodyUserId = body.userId;
    if (headerUserId || bodyUserId) {
      userId = resolveUserId(headerUserId, bodyUserId);
    }
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    throw err;
  }

  let userMessage: string;
  try {
    userMessage = latestUserContent(body);
  } catch {
    return c.json({ error: "A user message is required" }, HttpCodes.BAD_REQUEST);
  }

  // Backend owns history. Frontend only sends the latest turn + sessionId.
  let state: ConversationState;
  try {
    state = conversationStateService.ensureSession({
      sessionId: body.sessionId,
      userId: userId ?? null,
    });
  } catch (err) {
    if (
      err instanceof ConversationSessionUserMismatchError ||
      err instanceof ConversationSessionUserRequiredError
    ) {
      return c.json({ error: err.message }, HttpCodes.FORBIDDEN);
    }
    throw err;
  }
  state = conversationStateService.recordUserMessage(state, userMessage);

  c.var.logger.info(
    {
      sessionId: state.sessionId,
      hasUserId: Boolean(userId),
      activeAgentId: state.activeAgentId,
      mainHistoryLen: state.histories["main-router-agent"].messages.length,
    },
    "Agent chat requested",
  );

  try {
    const agent = mastra.getAgentById("main-router-agent");
    const generateMessages = conversationStateService.buildRouterMessages(
      state,
    ) as Parameters<typeof agent.generate>[0];

    const requestContext = new RequestContext();
    requestContext.setRaw("sessionId", state.sessionId);

    const response = await agent.generate(generateMessages, {
      modelSettings: {
        temperature: env.LLM_TEMPERATURE ?? 0.0,
        maxOutputTokens: env.LLM_MAX_TOKENS ?? 1000,
      },
      requestContext,
    });

    // Re-sync after route-to-agent tool wrote specialist history mid-generate.
    state = conversationStateService.getSession(state.sessionId) ?? state;

    const routed = inferSpecialistFromToolCalls(response.toolCalls);
    state = conversationStateService.recordAssistantAnswer(state, response.text, {
      specialisedAgentId: routed,
      toolCalls: response.toolCalls,
      // Tool already recorded the specialist's real reply; avoid double-write.
      mirrorToSpecialist: routed == null,
    });

    const recent = state.histories["main-router-agent"].messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const responseBody: ChatSuccessResponseBody = {
      text: response.text,
      sessionId: state.sessionId,
      lastAnswer: state.lastAnswer ?? response.text,
      activeAgentId: state.activeAgentId,
      lastAnswerAgentId: state.lastAnswerAgentId,
      toolCalls: response.toolCalls,
      messages: recent,
    };

    return c.json(responseBody, HttpCodes.OK);
  } catch (err) {
    c.var.logger.error({ err, sessionId: state.sessionId }, "Agent request failed");
    return c.json({ error: "Agent request failed" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
