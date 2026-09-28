import { createTool, type Tool } from "@mastra/core/tools";
import type { RequestContext } from "@mastra/core/request-context";
import type { output as ZodOutput, ZodTypeAny } from "zod";

/**
 * Keys the chat handler sets on Mastra request context.
 * Add a key here, read it in {@link BaseTool.resolveActor}, and every tool receives it.
 */
export const TOOL_REQUEST_KEYS = {
  userId: "userId",
  authUserId: "authUserId",
  sessionId: "sessionId",
} as const;

/**
 * Server-side identity available to every tool.
 * The model never supplies these fields.
 */
export type ToolActor = {
  userId: string;
  authUserId: string;
  sessionId: string;
};

export type ToolRunContext = {
  requestContext: RequestContext;
};

type ToolDefinition<TInputSchema extends ZodTypeAny, TOutputSchema extends ZodTypeAny> = {
  id: string;
  description: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  run: (
    input: ZodOutput<TInputSchema>,
    actor: ToolActor,
    context: ToolRunContext,
  ) => Promise<ZodOutput<TOutputSchema>>;
};

function readRequiredString(requestContext: RequestContext, key: string): string {
  const raw = requestContext.getRaw(key);
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`Missing ${key} on request context`);
  }
  return raw.trim();
}

/**
 * Mastra tool whose `run` receives the signed-in user from request context.
 * `inputSchema` is only what the model fills in.
 *
 * To give every tool another server-side value, add it to {@link ToolActor}
 * and {@link BaseTool.resolveActor}. Extend this class and override
 * `resolveActor` only when one tool needs something the others should not see.
 */
export class BaseTool<TInputSchema extends ZodTypeAny, TOutputSchema extends ZodTypeAny> {
  constructor(
    private readonly definition: ToolDefinition<TInputSchema, TOutputSchema>,
  ) {}

  private cachedTool?: Tool<ZodOutput<TInputSchema>, ZodOutput<TOutputSchema>>;

  /** Tool instance registered on an agent. */
  get tool(): Tool<ZodOutput<TInputSchema>, ZodOutput<TOutputSchema>> {
    if (!this.cachedTool) {
      this.cachedTool = createTool({
        id: this.definition.id,
        description: this.definition.description,
        inputSchema: this.definition.inputSchema,
        outputSchema: this.definition.outputSchema,
        execute: async (input, context) => {
          const actor = this.resolveActor(context.requestContext);
          return this.definition.run(input, actor, context);
        },
      }) as Tool<ZodOutput<TInputSchema>, ZodOutput<TOutputSchema>>;
    }
    return this.cachedTool;
  }

  protected resolveActor(requestContext: RequestContext): ToolActor {
    return {
      userId: readRequiredString(requestContext, TOOL_REQUEST_KEYS.userId),
      authUserId: readRequiredString(requestContext, TOOL_REQUEST_KEYS.authUserId),
      sessionId: readRequiredString(requestContext, TOOL_REQUEST_KEYS.sessionId),
    };
  }
}
