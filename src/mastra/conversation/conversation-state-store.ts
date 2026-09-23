import {
  createEmptyConversationState,
  type ConversationState,
} from "./types.js";

/**
 * In-memory session store. Backend owns mutation; replace with Redis/DB
 * later without changing ConversationStateService call sites.
 */
export class ConversationStateStore {
  private readonly sessions = new Map<string, ConversationState>();

  get(sessionId: string): ConversationState | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreate(params: {
    sessionId: string;
    userId?: string | null;
  }): ConversationState {
    const existing = this.sessions.get(params.sessionId);
    if (existing) {
      if (params.userId && !existing.userId) {
        existing.userId = params.userId;
        existing.updatedAt = new Date().toISOString();
      }
      return existing;
    }
    const created = createEmptyConversationState(params);
    this.sessions.set(params.sessionId, created);
    return created;
  }

  save(state: ConversationState): ConversationState {
    const next = { ...state, updatedAt: new Date().toISOString() };
    this.sessions.set(next.sessionId, next);
    return next;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  size(): number {
    return this.sessions.size;
  }
}

export const conversationStateStore = new ConversationStateStore();
