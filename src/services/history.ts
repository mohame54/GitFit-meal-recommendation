import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import type {
  FeedbackHistoryItem,
  RecommendationHistoryItem,
} from "../types/index.js";

const logger = createServiceLogger("history");

export async function getRecommendationHistory(
  userId: string,
  limit = 20,
): Promise<RecommendationHistoryItem[]> {
  logger.debug({ userId, limit }, "Getting recommendation history");
  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "id, recipe_id, context, score, shown_at, recipe:recipes(id, title, calories, ready_in_minutes, image_url, vegan, vegetarian, gluten_free, dairy_free, external_id, source_api, servings, protein_g, carbs_g, fat_g)",
    )
    .eq("user_id", userId)
    .order("shown_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error, userId, limit }, "Failed to get recommendation history");
    throw error;
  }

  logger.debug({ userId, count: data?.length ?? 0 }, "Got recommendation history");
  return (data ?? []).map((row) => ({
    id: row.id,
    recipe_id: row.recipe_id,
    context: row.context,
    score: row.score,
    shown_at: row.shown_at,
    recipe: Array.isArray(row.recipe) ? row.recipe[0] ?? null : row.recipe,
  }));
}

export async function getFeedbackHistory(
  userId: string,
  limit = 20,
): Promise<FeedbackHistoryItem[]> {
  logger.debug({ userId, limit }, "Getting feedback history");
  const { data, error } = await supabase
    .from("feedback")
    .select("id, recipe_id, rating, liked, comment, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error, userId, limit }, "Failed to get feedback history");
    throw error;
  }
  logger.debug({ userId, count: data?.length ?? 0 }, "Got feedback history");
  return data ?? [];
}
