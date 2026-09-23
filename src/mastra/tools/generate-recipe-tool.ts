import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateRecipeForUser } from "../../services/generation.js";

export const generateRecipeTool = createTool({
  id: "generate-recipe",
  description:
    "Generate a new personalized recipe for a user using their constraints and preferences. " +
    "Use this when the user asks to invent/create a custom recipe, or when catalog recommendations are not enough.",
  inputSchema: z.object({
    userId: z.string().describe("The user's UUID"),
    prompt: z
      .string()
      .optional()
      .describe("Optional free-text request, e.g. 'quick high-protein lunch'"),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string().optional(),
      }),
    ),
    steps: z.array(z.string()),
    calories: z.number().nullable().optional(),
    readyInMinutes: z.number().nullable().optional(),
  }),
  execute: async ({ userId, prompt }) => {
    const recipe = await generateRecipeForUser({ userId, prompt });
    return {
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      calories: recipe.calories ?? null,
      readyInMinutes: recipe.ready_in_minutes ?? null,
    };
  },
});
