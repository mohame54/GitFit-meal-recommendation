import { z } from "@hono/zod-openapi";

export const GenerateRecipeBodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    prompt: z.string().trim().min(1).optional(),
  })
  .openapi("GenerateRecipeBody");

export const GeneratedRecipeSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string().optional(),
      }),
    ),
    steps: z.array(z.string()),
    tags: z.array(
      z.object({
        type: z.string(),
        value: z.string(),
      }),
    ),
    calories: z.number().nullable().optional(),
    ready_in_minutes: z.number().nullable().optional(),
    servings: z.number().nullable().optional(),
    is_valid: z.boolean(),
    created_at: z.string(),
  })
  .openapi("GeneratedRecipe");

export const ListGeneratedQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
