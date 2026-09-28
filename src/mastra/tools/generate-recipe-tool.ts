import { z } from "zod";
import { generateRecipeForUser } from "../../services/generation.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z.object({
  prompt: z
    .string()
    .optional()
    .describe("Optional free-text request, e.g. 'quick high-protein lunch'"),
});

const outputSchema = z.object({
  id: z.string(),
  title: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      aisle: z.string().nullable(),
    }),
  ),
  steps: z.array(z.string()),
  calories: z.number().nullable().optional(),
  readyInMinutes: z.number().nullable().optional(),
});

const GenerateRecipeDesc= `
Generate a new personalized recipe for the signed-in user using their constraints and preferences. 
Use this when the user asks to invent/create a custom recipe, or when catalog recommendations are not enough.
`;

class GenerateRecipeTool extends BaseTool<typeof inputSchema, typeof outputSchema> {
  readonly id = "generate-recipe";

  constructor() {
    super({
      description: GenerateRecipeDesc,
      inputSchema,
      outputSchema,
      run: async ({ prompt }, actor) => {
        const recipe = await generateRecipeForUser({ userId: actor.userId, prompt });
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
  }
}

export const generateRecipeTool = new GenerateRecipeTool().tool;
