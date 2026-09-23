import { describe, expect, it, beforeEach } from "vitest";
import { ConversationStateStore } from "../mastra/conversation/conversation-state-store.js";
import { MessageSummarizer } from "../mastra/conversation/message-summarizer.js";
import {
  ConversationSessionUserMismatchError,
  ConversationSessionUserRequiredError,
  ConversationStateService,
  inferSpecialistFromToolCalls,
} from "./conversation.js";

describe("ConversationStateService", () => {
  let service: ConversationStateService;

  beforeEach(() => {
    service = new ConversationStateService(
      new ConversationStateStore(),
      new MessageSummarizer({ maxMessages: 6, keepRecent: 3 }),
    );
  });

  it("creates a session and tracks lastAnswer for follow-ups", () => {
    let state = service.ensureSession({ userId: "00000000-0000-4000-8000-000000000001" });
    const sessionId = state.sessionId;

    state = service.recordUserMessage(state, "I'm new");
    state = service.recordAssistantAnswer(state, "Step 1: pick a diet?", {
      specialisedAgentId: "onboarding-agent",
    });

    expect(state.sessionId).toBe(sessionId);
    expect(state.lastAnswer).toBe("Step 1: pick a diet?");
    expect(state.activeAgentId).toBe("onboarding-agent");
    expect(state.histories["onboarding-agent"].messages.length).toBeGreaterThan(0);

    state = service.recordUserMessage(state, "skip");
    const modelMsgs = service.buildRouterMessages(state);
    const systemBlob = modelMsgs
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    expect(systemBlob).toContain("Step 1: pick a diet?");
    expect(systemBlob).toContain("onboarding-agent");
    expect(modelMsgs.some((m) => m.role === "user" && m.content === "skip")).toBe(true);
  });

  it("reuses the same session when sessionId is provided", () => {
    const first = service.ensureSession({});
    const second = service.ensureSession({ sessionId: first.sessionId });
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("rejects access to a user-bound session without matching user id", () => {
    const first = service.ensureSession({
      userId: "00000000-0000-4000-8000-000000000001",
    });

    expect(() => service.ensureSession({ sessionId: first.sessionId })).toThrow(
      ConversationSessionUserRequiredError,
    );
    expect(() =>
      service.ensureSession({
        sessionId: first.sessionId,
        userId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toThrow(ConversationSessionUserMismatchError);
  });

  it("records actual specialist delegation prompt and result", () => {
    let state = service.ensureSession({
      userId: "00000000-0000-4000-8000-000000000001",
    });

    const start = service.recordDelegationStart(state, {
      primitiveId: "onboarding-agent",
      primitiveType: "agent",
      prompt: "Ask step 1",
    });
    expect(start?.agentId).toBe("onboarding-agent");
    state = start!.state;

    const complete = service.recordDelegationComplete(state, {
      primitiveId: "onboarding-agent",
      primitiveType: "agent",
      text: "Do you follow any of these diets?",
    });
    expect(complete?.agentId).toBe("onboarding-agent");
    state = complete!.state;

    expect(state.activeAgentId).toBe("onboarding-agent");
    expect(state.histories["onboarding-agent"].messages.map((m) => m.content)).toEqual([
      "Ask step 1",
      "Do you follow any of these diets?",
    ]);

    state = service.recordAssistantAnswer(state, "Do you follow any of these diets?", {
      specialisedAgentId: "onboarding-agent",
      mirrorToSpecialist: false,
    });

    expect(state.histories["onboarding-agent"].messages.map((m) => m.content)).toEqual([
      "Ask step 1",
      "Do you follow any of these diets?",
    ]);
    expect(state.lastAnswerAgentId).toBe("onboarding-agent");
  });
});

describe("inferSpecialistFromToolCalls", () => {
  it("maps agent tool names to AgentId", () => {
    expect(
      inferSpecialistFromToolCalls([{ toolName: "agent-onboardingAgent" }]),
    ).toBe("onboarding-agent");
    expect(inferSpecialistFromToolCalls([{ name: "nutrition-agent" }])).toBe(
      "nutrition-agent",
    );
    expect(inferSpecialistFromToolCalls([])).toBeNull();
  });
});
