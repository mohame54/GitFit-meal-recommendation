import { RequestContext } from "@mastra/core/request-context";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BaseTool, TOOL_REQUEST_KEYS } from "./base-tool.js";

const inputSchema = z.object({
  note: z.string(),
});

const outputSchema = z.object({
  note: z.string(),
  userId: z.string(),
});

function actorContext(): RequestContext {
  const requestContext = new RequestContext();
  requestContext.setRaw(TOOL_REQUEST_KEYS.userId, "00000000-0000-4000-8000-000000000001");
  requestContext.setRaw(TOOL_REQUEST_KEYS.authUserId, "00000000-0000-4000-8000-000000000002");
  requestContext.setRaw(TOOL_REQUEST_KEYS.sessionId, "session-1");
  return requestContext;
}

describe("BaseTool", () => {
  const echoTool = new BaseTool({
    id: "echo-user",
    description: "Echo the note and the signed-in user.",
    inputSchema,
    outputSchema,
    run: async (input, actor) => {
      return { note: input.note, userId: actor.userId };
    },
  }).tool;

  it("injects the signed-in user instead of a model-supplied id", async () => {
    const result = await echoTool.execute?.(
      { note: "hello", userId: "not-from-the-model" } as { note: string },
      { requestContext: actorContext() } as never,
    );

    expect(result).toEqual({
      note: "hello",
      userId: "00000000-0000-4000-8000-000000000001",
    });
    expect(inputSchema.shape).not.toHaveProperty("userId");
  });

  it("refuses to run when request context has no user id", async () => {
    const requestContext = actorContext();
    requestContext.setRaw(TOOL_REQUEST_KEYS.userId, "  ");

    await expect(
      echoTool.execute?.({ note: "hello" }, { requestContext } as never),
    ).rejects.toThrow(/userId/);
  });
});
