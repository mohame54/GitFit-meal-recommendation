import { describe, expect, it } from "vitest";
import { MessageSummarizer } from "./message-summarizer.js";
import { createEmptyAgentHistory, type ConversationMessage } from "./types.js";

function msg(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    agentId: "main-router-agent",
  };
}

describe("MessageSummarizer", () => {
  it("keeps messages under the limit without summarizing", () => {
    const summarizer = new MessageSummarizer({ maxMessages: 5, keepRecent: 3 });
    let history = createEmptyAgentHistory("main-router-agent");
    history = summarizer.append(history, msg("user", "hi"));
    history = summarizer.append(history, msg("assistant", "hello"));
    expect(history.summary).toBeNull();
    expect(history.messages).toHaveLength(2);
  });

  it("summarizes older turns when over maxMessages", () => {
    const summarizer = new MessageSummarizer({ maxMessages: 4, keepRecent: 2 });
    let history = createEmptyAgentHistory("onboarding-agent");
    for (let i = 0; i < 5; i += 1) {
      history = summarizer.append(history, msg("user", `u${i}`));
      history = summarizer.append(history, msg("assistant", `a${i}`));
    }
    expect(history.messages.length).toBeLessThanOrEqual(4);
    expect(history.summary).toBeTruthy();
    expect(history.summary).toContain("u0");
    expect(history.messages.some((m) => m.content === "a4")).toBe(true);
  });

  it("includes lastAnswer and summary in model messages", () => {
    const summarizer = new MessageSummarizer({ maxMessages: 10, keepRecent: 4 });
    let history = createEmptyAgentHistory("main-router-agent");
    history = summarizer.append(history, msg("user", "change my name"));
    history = {
      ...history,
      summary: "User previously asked about vegan options.",
    };
    const modelMsgs = summarizer.toModelMessages(history, {
      systemPrefix: "Trusted userId: abc",
      lastAnswer: "Should I set displayName to Mo?",
    });
    expect(modelMsgs[0]?.role).toBe("system");
    expect(modelMsgs[0]?.content).toContain("Trusted userId");
    expect(modelMsgs[0]?.content).toContain("Last assistant answer");
    expect(modelMsgs[0]?.content).toContain("Should I set displayName to Mo?");
    expect(modelMsgs[0]?.content).toContain("vegan options");
    expect(modelMsgs.at(-1)).toEqual({ role: "user", content: "change my name" });
  });
});
