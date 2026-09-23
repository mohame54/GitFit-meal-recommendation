import { z } from "@hono/zod-openapi";
import { AGENT_IDS } from "../../mastra/conversation/types.js";

export const ChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1),
  })
  .openapi("ChatMessage");

/**
 * Preferred request: frontend sends only the latest user turn.
 * Backend owns session history via sessionId.
 */
export const ChatTurnRequestBodySchema = z
  .object({
    message: z.string().trim().min(1),
    sessionId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  })
  .openapi("ChatTurnRequestBody");

/**
 * Legacy: client-managed transcript. Still accepted, but the server
 * merges into its own session state and remains the source of truth.
 */
export const ChatHistoryRequestBodySchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1),
    sessionId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  })
  .openapi("ChatHistoryRequestBody");

export const ChatRequestBodySchema = z
  .union([ChatTurnRequestBodySchema, ChatHistoryRequestBodySchema])
  .openapi("ChatRequestBody");

export const AgentIdSchema = z.enum(AGENT_IDS).openapi("AgentId");

export const ChatSuccessResponseBodySchema = z
  .object({
    text: z.string(),
    sessionId: z.string().uuid(),
    lastAnswer: z.string(),
    activeAgentId: AgentIdSchema,
    lastAnswerAgentId: AgentIdSchema.nullable(),
    toolCalls: z.array(z.unknown()).optional(),
    /** Recent main-router window for optional UI display (not required next turn). */
    messages: z.array(ChatMessageSchema).optional(),
  })
  .openapi("ChatSuccessResponseBody");

export const ChatErrorResponseBodySchema = z.object({
  error: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>;
export type ChatSuccessResponseBody = z.infer<typeof ChatSuccessResponseBodySchema>;
export type ChatErrorResponseBody = z.infer<typeof ChatErrorResponseBodySchema>;

export const chatRequestBodyExample: ChatRequestBody = {
  message: "Something quicker please",
  sessionId: "11111111-1111-4111-8111-111111111111",
  userId: "00000000-0000-4000-8000-000000000001",
};

export const chatSuccessResponseBodyExample: ChatSuccessResponseBody = {
  text: "Here is a quicker option...",
  sessionId: "11111111-1111-4111-8111-111111111111",
  lastAnswer: "Here is a quicker option...",
  activeAgentId: "nutrition-agent",
  lastAnswerAgentId: "nutrition-agent",
  toolCalls: [],
  messages: [
    { role: "user", content: "Something quicker please" },
    { role: "assistant", content: "Here is a quicker option..." },
  ],
};
