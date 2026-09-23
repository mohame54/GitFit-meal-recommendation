import type { AgentHistory, ConversationMessage } from "./types.js";

export interface MessageSummarizerOptions {
  /** Max raw messages kept in `history.messages` before summarizing older ones. */
  maxMessages: number;
  /** How many newest messages to keep verbatim after a summarize pass. */
  keepRecent: number;
  /** Soft cap on characters for a single summary blob. */
  maxSummaryChars: number;
}

const DEFAULT_OPTIONS: MessageSummarizerOptions = {
  maxMessages: 24,
  keepRecent: 10,
  maxSummaryChars: 2000,
};

/**
 * Manages per-agent history size: keeps a recent window and folds older
 * turns into a compact `summary` string the backend injects as context.
 */
export class MessageSummarizer {
  private readonly options: MessageSummarizerOptions;

  constructor(options: Partial<MessageSummarizerOptions> = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    if (merged.keepRecent < 1) {
      throw new Error("keepRecent must be >= 1");
    }
    if (merged.maxMessages < merged.keepRecent) {
      throw new Error("maxMessages must be >= keepRecent");
    }
    this.options = merged;
  }

  getOptions(): Readonly<MessageSummarizerOptions> {
    return this.options;
  }

  /**
   * Append a message, then summarize if the window exceeds `maxMessages`.
   * Returns a new history object (does not mutate the input).
   */
  append(history: AgentHistory, message: ConversationMessage): AgentHistory {
    const next: AgentHistory = {
      ...history,
      messages: [...history.messages, message],
    };
    return this.summarizeIfNeeded(next);
  }

  /**
   * If over the limit, compress the older slice into `summary` and keep
   * only `keepRecent` messages.
   */
  summarizeIfNeeded(history: AgentHistory): AgentHistory {
    const { maxMessages, keepRecent } = this.options;
    if (history.messages.length <= maxMessages) {
      return history;
    }

    const cut = history.messages.length - keepRecent;
    const older = history.messages.slice(0, cut);
    const recent = history.messages.slice(cut);
    const chunk = this.formatTurns(older);
    const summary = this.mergeSummaries(history.summary, chunk);

    return {
      ...history,
      summary,
      messages: recent,
    };
  }

  /**
   * Build the message list to send into an LLM call:
   * optional system summary + recent turns (and any extra system prefixes).
   */
  toModelMessages(
    history: AgentHistory,
    extras?: {
      systemPrefix?: string;
      lastAnswer?: string | null;
    },
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const out: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

    const systemParts: string[] = [];
    if (extras?.systemPrefix?.trim()) {
      systemParts.push(extras.systemPrefix.trim());
    }
    if (extras?.lastAnswer?.trim()) {
      systemParts.push(
        `Last assistant answer shown to the user:\n"""${extras.lastAnswer.trim()}"""\n` +
          "If the user replies with yes/no/skip/ok, interpret it relative to that answer.",
      );
    }
    if (history.summary?.trim()) {
      systemParts.push(
        `Earlier conversation summary for ${history.agentId}:\n${history.summary.trim()}`,
      );
    }
    if (systemParts.length > 0) {
      out.push({ role: "system", content: systemParts.join("\n\n") });
    }

    for (const m of history.messages) {
      if (m.role === "system") continue;
      out.push({ role: m.role, content: m.content });
    }

    return out;
  }

  private formatTurns(messages: ConversationMessage[]): string {
    return messages
      .map((m) => {
        const who = m.agentId ? `${m.role}(${m.agentId})` : m.role;
        return `${who}: ${m.content}`;
      })
      .join("\n");
  }

  private mergeSummaries(existing: string | null, chunk: string): string {
    const merged = [existing?.trim(), chunk.trim()].filter(Boolean).join("\n---\n");
    const { maxSummaryChars } = this.options;
    if (merged.length <= maxSummaryChars) return merged;
    // Keep the newest portion of the summary when over the soft cap.
    return merged.slice(merged.length - maxSummaryChars);
  }
}

/** Shared default summarizer for conversation state. */
export const defaultMessageSummarizer = new MessageSummarizer();
