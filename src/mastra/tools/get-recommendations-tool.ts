import { z } from "zod";
import { getRecommendations } from "../../services/recommendations.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z.object({
  limit: z.number().optional().default(10).describe("How many recipes to return"),
});

const outputSchema = z.object({
  recommendations: z.array(
    z.object({
      title: z.string(),
      score: z.number(),
      calories: z.number().nullable(),
      readyInMinutes: z.number().nullable(),
    }),
  ),
});

/**
 * Wraps the existing deterministic recommendation engine as a tool.
 * The agent decides WHEN to call this and HOW to present the result,
 * but the filtering/scoring logic itself stays in services/recommendations.ts —
 * unchanged, untouched by the agent, fully inspectable and testable on its own.
 */

const GetRecommendationsDesc= `
  "Get ranked recipe recommendations for the signed-in user, already filtered by their " +
        "hard constraints (allergies, diet) and scored against their preferences. " +
        "Use this whenever the user asks what they should eat, wants suggestions, " +
        "or asks for meal ideas."
`
class GetRecommendationsTool extends BaseTool<typeof inputSchema, typeof outputSchema> {
  readonly id = "get-recommendations";

  constructor() {
    super({
      description:GetRecommendationsDesc,
      inputSchema,
      outputSchema,
      run: async ({ limit }, actor) => {
        const ranked = await getRecommendations(actor.userId, limit);
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
  }
}

export const getRecommendationsTool = new GetRecommendationsTool().tool;
