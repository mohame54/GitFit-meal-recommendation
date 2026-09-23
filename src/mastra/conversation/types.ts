/**
 * Backend-owned conversation state. The frontend should only send the latest
 * user message (+ optional sessionId); the server mutates histories.
 */

export const AGENT_IDS = [
  "main-router-agent",
  "onboarding-agent",
  "nutrition-agent",
  "feedback-extraction-agent",
  "recipe-generation-agent",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  /** ISO timestamp when the backend recorded this turn. */
  timestamp: string;
  /** Which agent produced this turn (assistant) or was targeted (user). */
  agentId?: AgentId;
}

/**
 * Per-agent message history. Older turns may be compressed into `summary`
 * by {@link MessageSummarizer}; `messages` holds the recent window.
 */
export interface AgentHistory {
  agentId: AgentId;
  messages: ConversationMessage[];
  /** Compressed older conversation context for this agent. */
  summary: string | null;
}

/**
 * Full conversation session state owned solely by the backend.
 */
export interface ConversationState {
  sessionId: string;
  userId: string | null;
  /** Specialist (or router) that should receive follow-up context next. */
  activeAgentId: AgentId;
  /** Last assistant reply shown to the user (always from the main router). */
  lastAnswer: string | null;
  lastAnswerAgentId: AgentId | null;
  histories: Record<AgentId, AgentHistory>;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyAgentHistory(agentId: AgentId): AgentHistory {
  return {
    agentId,
    messages: [],
    summary: null,
  };
}

export function createEmptyConversationState(params: {
  sessionId: string;
  userId?: string | null;
}): ConversationState {
  const now = new Date().toISOString();
  const histories = Object.fromEntries(
    AGENT_IDS.map((id) => [id, createEmptyAgentHistory(id)]),
  ) as Record<AgentId, AgentHistory>;

  return {
    sessionId: params.sessionId,
    userId: params.userId ?? null,
    activeAgentId: "main-router-agent",
    lastAnswer: null,
    lastAnswerAgentId: null,
    histories,
    createdAt: now,
    updatedAt: now,
  };
}

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}
