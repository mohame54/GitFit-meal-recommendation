import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getRecommendations } from "../../services/recommendations.js";

/**
 * Wraps the existing deterministic recommendation engine as a tool.
 * The agent decides WHEN to call this and HOW to present the result,
 * but the filtering/scoring logic itself stays in services/recommendations.ts —
 * unchanged, untouched by the agent, fully inspectable and testable on its own.
 */
export const getRecommendationsTool = createTool({
  id: "get-recommendations",
  description:
    "Get ranked recipe recommendations for a user, already filtered by their " +
    "hard constraints (allergies, diet) and scored against their preferences. " +
    "Use this whenever the user asks what they should eat, wants suggestions, " +
    "or asks for meal ideas.",
  inputSchema: z.object({
    userId: z.string().describe("The user's UUID"),
    limit: z.number().optional().default(10).describe("How many recipes to return"),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        title: z.string(),
        score: z.number(),
        calories: z.number().nullable(),
        readyInMinutes: z.number().nullable(),
      })
    ),
  }),
  execute: async ({ userId, limit }) => {
    const ranked = await getRecommendations(userId, limit);
    return {
      recommendations: ranked.map((r) => ({
        title: r.recipe.title,
        score: r.score,
        calories: r.recipe.calories,
        readyInMinutes: r.recipe.ready_in_minutes,
      })),
    };
  },
});
