import { z } from "@hono/zod-openapi";

export const GetRecommendationsQuerySchema = z.object({
  userId: z.string().trim().min(1).optional().openapi({
    example: "00000000-0000-0000-0000-000000000001",
  }),
  limit: z.coerce.number().int().positive().optional().openapi({
    example: 5,
  }),
});

export const RecipeResponseBodySchema = z
  .object({
    id: z.string(),
    external_id: z.string().nullable(),
    source_api: z.string(),
    title: z.string(),
    image_url: z.string().nullable(),
    ready_in_minutes: z.number().nullable(),
    servings: z.number().nullable(),
    calories: z.number().nullable(),
    protein_g: z.number().nullable(),
    carbs_g: z.number().nullable(),
    fat_g: z.number().nullable(),
    vegan: z.boolean(),
    vegetarian: z.boolean(),
    gluten_free: z.boolean(),
    dairy_free: z.boolean(),
  })
  .openapi("Recipe");

export const ScoredRecipeResponseBodySchema = z
  .object({
    recipe: RecipeResponseBodySchema,
    score: z.number(),
  })
  .openapi("ScoredRecipe");

export const GetRecommendationsSuccessResponseBodySchema = z.array(
  ScoredRecipeResponseBodySchema,
);

export const GetRecommendationsErrorResponseBodySchema = z.object({
  error: z.string(),
});

export type GetRecommendationsQuery = z.infer<typeof GetRecommendationsQuerySchema>;
export type GetRecommendationsSuccessResponseBody = z.infer<
  typeof GetRecommendationsSuccessResponseBodySchema
>;
export type GetRecommendationsErrorResponseBody = z.infer<
  typeof GetRecommendationsErrorResponseBodySchema
>;

export const getRecommendationsQueryExample: GetRecommendationsQuery = {
  userId: "00000000-0000-0000-0000-000000000001",
  limit: 5,
};
