import { z } from "@hono/zod-openapi";
import { RecipeResponseBodySchema } from "../recommendations/recommendations.schemas.js";

export const ListRecipesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const RecipeIdParamSchema = z.object({
  recipeId: z.string().uuid(),
});

export const RecipeDetailSchema = z
  .object({
    recipe: RecipeResponseBodySchema,
    attributes: z.array(
      z.object({
        attribute_type: z.string(),
        attribute_value: z.string(),
      }),
    ),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string().nullable(),
      }),
    ),
  })
  .openapi("RecipeDetail");
