import { z } from "@hono/zod-openapi";
import { RecipeResponseBodySchema } from "../recommendations/recommendations.schemas.js";

export const HistoryQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const RecommendationHistoryItemSchema = z
  .object({
    id: z.string(),
    recipe_id: z.string(),
    context: z.string(),
    score: z.number(),
    shown_at: z.string(),
    recipe: RecipeResponseBodySchema.partial().nullable().optional(),
  })
  .openapi("RecommendationHistoryItem");

export const FeedbackHistoryItemSchema = z
  .object({
    id: z.string(),
    recipe_id: z.string(),
    rating: z.number().nullable(),
    liked: z.boolean().nullable(),
    comment: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi("FeedbackHistoryItem");
