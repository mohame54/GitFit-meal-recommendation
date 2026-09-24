import { randomUUID } from "node:crypto";
import {
  conversationStateStore,
  type ConversationStateStore,
} from "../mastra/conversation/conversation-state-store.js";
import {
  defaultMessageSummarizer,
  type MessageSummarizer,
} from "../mastra/conversation/message-summarizer.js";
import {
  type AgentId,
  type ConversationMessage,
  type ConversationState,
  isAgentId,
} from "../mastra/conversation/types.js";

const SPECIALIST_NAME_TO_ID: Record<string, AgentId> = {
  onboardingagent: "onboarding-agent",
  "onboarding-agent": "onboarding-agent",
  nutritionagent: "nutrition-agent",
  "nutrition-agent": "nutrition-agent",
  feedbackextractionagent: "feedback-extraction-agent",
  "feedback-extraction-agent": "feedback-extraction-agent",
  recipegenerationagent: "recipe-generation-agent",
  "recipe-generation-agent": "recipe-generation-agent",
  mainrouteragent: "main-router-agent",
  "main-router-agent": "main-router-agent",
};

function nowIso(): string {
  return new Date().toISOString();
}

function makeMessage(
  role: ConversationMessage["role"],
  content: string,
  agentId?: AgentId,
): ConversationMessage {
  return {
    role,
    content,
    timestamp: nowIso(),
    agentId,
  };
}

export class ConversationSessionUserMismatchError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is bound to a different user`);
    this.name = "ConversationSessionUserMismatchError";
  }
}

export class ConversationSessionUserRequiredError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is bound to a user; pass a matching userId or X-User-Id`);
    this.name = "ConversationSessionUserRequiredError";
  }
}

export function resolveAgentId(value: string): AgentId | null {
  if (isAgentId(value)) return value;

  const normalized = value
    .replace(/^agent[-_]?/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();

  return SPECIALIST_NAME_TO_ID[normalized] ?? null;
}

/**
 * Backend-owned conversation orchestration: session lifecycle, per-agent
 * histories, summarization, and model-message assembly.
 */
export class ConversationStateService {
  constructor(
    private readonly store: ConversationStateStore = conversationStateStore,
    private readonly summarizer: MessageSummarizer = defaultMessageSummarizer,
  ) {}

  /**
   * Resolve or create a session. Frontend may omit sessionId on first turn.
   */
  ensureSession(params: {
    sessionId?: string | null;
    userId?: string | null;
  }): ConversationState {
    const sessionId = params.sessionId?.trim() || randomUUID();
    const existing = this.store.get(sessionId);
    if (existing?.userId) {
      if (!params.userId) {
        throw new ConversationSessionUserRequiredError(sessionId);
      }
      if (existing.userId !== params.userId) {
        throw new ConversationSessionUserMismatchError(sessionId);
      }
    }

    return this.store.getOrCreate({
      sessionId,
      userId: params.userId ?? null,
    });
  }

  getSession(sessionId: string): ConversationState | undefined {
    return this.store.get(sessionId);
  }

  /**
   * Record the user's latest message on the main router history (and the
   * currently active specialist, so follow-ups stay coherent).
   */
  recordUserMessage(state: ConversationState, content: string): ConversationState {
    const msg = makeMessage("user", content, state.activeAgentId);
    let next = this.appendToAgent(state, "main-router-agent", msg);
    if (state.activeAgentId !== "main-router-agent") {
      next = this.appendToAgent(next, state.activeAgentId, msg);
    }
    return this.store.save(next);
  }

  /**
   * Record the main router's user-facing answer and optionally note which
   * specialist was involved this turn.
   */
  recordAssistantAnswer(
    state: ConversationState,
    text: string,
    opts?: {
      specialisedAgentId?: AgentId | null;
      toolCalls?: unknown;
      mirrorToSpecialist?: boolean;
    },
  ): ConversationState {
    const specialised =
      opts?.specialisedAgentId ??
      inferSpecialistFromToolCalls(opts?.toolCalls) ??
      null;

    const routerMsg = makeMessage("assistant", text, "main-router-agent");
    let next = this.appendToAgent(state, "main-router-agent", routerMsg);

    if (
      specialised &&
      specialised !== "main-router-agent" &&
      (opts?.mirrorToSpecialist ?? true)
    ) {
      const specialistMsg = makeMessage("assistant", text, specialised);
      next = this.appendToAgent(next, specialised, specialistMsg);
      next = {
        ...next,
        activeAgentId: specialised,
      };
    } else if (specialised && specialised !== "main-router-agent") {
      next = {
        ...next,
        activeAgentId: specialised,
      };
    } else {
      next = {
        ...next,
        activeAgentId: "main-router-agent",
      };
    }

    next = {
      ...next,
      lastAnswer: text,
      lastAnswerAgentId: specialised ?? "main-router-agent",
    };

    return this.store.save(next);
  }

  recordDelegationStart(
    state: ConversationState,
    params: {
      primitiveId: string;
      primitiveType: "agent" | "workflow";
      prompt: string;
    },
  ): { state: ConversationState; agentId: AgentId } | null {
    if (params.primitiveType !== "agent") return null;
    const agentId = resolveAgentId(params.primitiveId);
    if (!agentId || agentId === "main-router-agent") return null;

    const msg = makeMessage("user", params.prompt, agentId);
    const next = this.appendToAgent(state, agentId, msg);
    return {
      state: this.store.save({ ...next, activeAgentId: agentId }),
      agentId,
    };
  }

  recordDelegationComplete(
    state: ConversationState,
    params: {
      primitiveId: string;
      primitiveType: "agent" | "workflow";
      text: string;
    },
  ): { state: ConversationState; agentId: AgentId } | null {
    if (params.primitiveType !== "agent") return null;
    const agentId = resolveAgentId(params.primitiveId);
    if (!agentId || agentId === "main-router-agent") return null;

    const msg = makeMessage("assistant", params.text || "(no text returned)", agentId);
    const next = this.appendToAgent(state, agentId, msg);
    return {
      state: this.store.save({ ...next, activeAgentId: agentId }),
      agentId,
    };
  }

  /**
   * Build messages for the main router: last-answer awareness + summarized
   * main history + optional active specialist recent context.
   */
  buildRouterMessages(state: ConversationState): Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> {
    const main = state.histories["main-router-agent"];
    const systemParts: string[] = [];

    if (state.userId) {
      systemParts.push(
        `Trusted userId for this conversation: ${state.userId}. ` +
          "Use this UUID for all tools and specialist delegations that require a userId. " +
          "Do not ask the user for their ID unless a different user is needed.",
      );
    }

    systemParts.push(
      `Conversation sessionId: ${state.sessionId}. ` +
        `Active specialist context: ${state.activeAgentId}.`,
    );

    const messages = this.summarizer.toModelMessages(main, {
      systemPrefix: systemParts.join(" "),
      lastAnswer: state.lastAnswer,
    });

    if (state.activeAgentId !== "main-router-agent") {
      const specialist = state.histories[state.activeAgentId];
      if (specialist.summary || specialist.messages.length > 0) {
        const snippet = [
          specialist.summary
            ? `Summary (${state.activeAgentId}): ${specialist.summary}`
            : null,
          ...specialist.messages.slice(-6).map((m) => `${m.role}: ${m.content}`),
        ]
          .filter(Boolean)
          .join("\n");
        if (snippet) {
          messages.splice(1, 0, {
            role: "system",
            content:
              `Recent context from active specialist ${state.activeAgentId}:\n${snippet}`,
          });
        }
      }
    }

    return messages;
  }

  /**
   * Build messages for a specialist agent from its own history/summary.
   * Used by route-to-agent so multi-turn specialist flows keep context.
   */
  buildAgentMessages(
    state: ConversationState,
    agentId: AgentId,
  ): Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> {
    const history = state.histories[agentId];
    const systemParts: string[] = [];

    if (state.userId) {
      systemParts.push(
        `Trusted userId for this conversation: ${state.userId}. ` +
          "Use this UUID for all tools that require a userId. " +
          "Do not ask the user for their ID unless a different user is needed.",
      );
    }

    systemParts.push(
      `Conversation sessionId: ${state.sessionId}. ` +
        `You are ${agentId}. Continue this specialist thread coherently.`,
    );

    return this.summarizer.toModelMessages(history, {
      systemPrefix: systemParts.join(" "),
      lastAnswer: state.lastAnswer,
    });
  }

  clearSession(sessionId: string): boolean {
    return this.store.delete(sessionId);
  }

  private appendToAgent(
    state: ConversationState,
    agentId: AgentId,
    message: ConversationMessage,
  ): ConversationState {
    const history = state.histories[agentId];
    const updated = this.summarizer.append(history, message);
    return {
      ...state,
      histories: {
        ...state.histories,
        [agentId]: updated,
      },
    };
  }
}

function pickTargetAgentId(value: unknown): AgentId | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const candidates = [
    rec.targetAgentId,
    rec.agentId,
    // Nested shapes Mastra may wrap around tool args / results
    typeof rec.args === "object" && rec.args
      ? (rec.args as Record<string, unknown>).targetAgentId
      : null,
    typeof rec.input === "object" && rec.input
      ? (rec.input as Record<string, unknown>).targetAgentId
      : null,
    typeof rec.result === "object" && rec.result
      ? (rec.result as Record<string, unknown>).targetAgentId
      : null,
    typeof rec.output === "object" && rec.output
      ? (rec.output as Record<string, unknown>).targetAgentId
      : null,
  ];

  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const agentId = resolveAgentId(raw);
    if (agentId && agentId !== "main-router-agent") return agentId;
  }
  return null;
}

/**
 * Best-effort mapping from Mastra supervisor toolCalls to a specialist id.
 * Supports built-in agent-* tool names and the explicit route-to-agent tool.
 */
export function inferSpecialistFromToolCalls(toolCalls: unknown): AgentId | null {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  for (const call of toolCalls) {
    if (!call || typeof call !== "object") continue;
    const rec = call as Record<string, unknown>;
    const payload = (rec.payload ?? rec) as Record<string, unknown>;

    const fromTarget = pickTargetAgentId(payload) ?? pickTargetAgentId(rec);
    if (fromTarget) return fromTarget;

    const candidates = [
      payload.toolName,
      payload.name,
      payload.tool,
      rec.toolName,
      rec.name,
    ];

    for (const raw of candidates) {
      if (typeof raw !== "string") continue;
      // route-to-agent alone is not a specialist; keep scanning for targetAgentId
      if (/route[-_]?to[-_]?agent/i.test(raw)) continue;
      const agentId = resolveAgentId(raw);
      if (agentId) return agentId;
    }
  }
  return null;
}

export const conversationStateService = new ConversationStateService();
