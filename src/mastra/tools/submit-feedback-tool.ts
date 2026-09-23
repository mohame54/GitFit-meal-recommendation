import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { submitFeedback } from "../../services/feedback.js";

/**
 * Wraps the existing feedback pipeline. The extraction + validation +
 * weight-capping logic all still live in services/feedback.ts, untouched —
 * this tool just gives the agent a way to trigger it from conversation.
 */
export const submitFeedbackTool = createTool({
  id: "submit-feedback",
  description:
    "Record a user's rating, like/dislike, or comment about a recipe. " +
    "Use this whenever the user reacts to a recipe they were shown or cooked — " +
    "e.g. 'that was too salty', 'I loved it', 'give it 4 stars'.",
  inputSchema: z.object({
    userId: z.string().describe("The user's UUID"),
    recipeId: z.string().describe("The recipe's UUID"),
    rating: z.number().min(1).max(5).optional(),
    liked: z.boolean().optional(),
    comment: z.string().optional(),
  }),
  outputSchema: z.object({ status: z.literal("ok") }),
  execute: async ({ userId, recipeId, rating, liked, comment }) => {
    await submitFeedback({ userId, recipeId, rating, liked, comment });
    return { status: "ok" as const };
  },
});
