import { z } from "zod";
import { submitFeedback } from "../../services/feedback.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z.object({
  recipeId: z.string().describe("The recipe's UUID"),
  rating: z.number().min(1).max(5).optional(),
  liked: z.boolean().optional(),
  comment: z.string().optional(),
});

const outputSchema = z.object({ status: z.literal("ok") });

/**
 * Wraps the existing feedback pipeline. The extraction + validation +
 * weight-capping logic all still live in services/feedback.ts, untouched —
 * this tool just gives the agent a way to trigger it from conversation.
 */
const SubmitFeedbackDesc = `
Record the signed-in user's rating, like/dislike, or comment about a recipe. 
Use this whenever the user reacts to a recipe they were shown or cooked — 
e.g. 'that was too salty', 'I loved it', 'give it 4 stars'.
`;
class SubmitFeedbackTool extends BaseTool<typeof inputSchema, typeof outputSchema> {
  readonly id = "submit-feedback";

  constructor() {
    super({
      description:SubmitFeedbackDesc,
      inputSchema,
      outputSchema,
      run: async ({ recipeId, rating, liked, comment }, actor) => {
        await submitFeedback({
          userId: actor.userId,
          recipeId,
          rating,
          liked,
          comment,
        });
        return { status: "ok" as const };
      },
    });
  }
}

export const submitFeedbackTool = new SubmitFeedbackTool().tool;
