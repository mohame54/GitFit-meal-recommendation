import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import { scoreRecipe } from "../lib/scoring.js";
import type {
  Recipe,
  RecipeAttribute,
  UserPreference,
  ScoredRecipe,
} from "../types/index.js";

const logger = createServiceLogger("recommendations");

/**
 * Calls the get_eligible_recipes() Postgres function, which excludes
 * anything violating the user's hard constraints (allergies, diet).
 * This is intentionally SQL, not app code or an LLM call.
 */
async function getEligibleRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase.rpc("get_eligible_recipes", {
    p_user_id: userId,
  });
  if (error) {
    logger.error({ err: error, userId }, "Failed to get eligible recipes");
    throw error;
  }
  return data ?? [];
}

async function getUserPreferences(userId: string): Promise<UserPreference[]> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preference_type, value, weight")
    .eq("user_id", userId);
  if (error) {
    logger.error({ err: error, userId }, "Failed to get user preferences");
    throw error;
  }
  return data ?? [];
}

/** Batch-fetch attributes for many recipes (avoids N+1). */
async function getRecipeAttributesBatch(
  recipeIds: string[],
): Promise<Map<string, RecipeAttribute[]>> {
  const map = new Map<string, RecipeAttribute[]>();
  if (recipeIds.length === 0) return map;

  const { data, error } = await supabase
    .from("recipe_attributes")
    .select("recipe_id, attribute_type, attribute_value")
    .in("recipe_id", recipeIds);
  if (error) {
    logger.error({ err: error, recipeCount: recipeIds.length }, "Failed to batch-fetch recipe attributes");
    throw error;
  }

  for (const row of data ?? []) {
    const list = map.get(row.recipe_id) ?? [];
    list.push({
      attribute_type: row.attribute_type,
      attribute_value: row.attribute_value,
    });
    map.set(row.recipe_id, list);
  }
  return map;
}

async function persistRecommendationHistory(
  userId: string,
  ranked: ScoredRecipe[],
  context = "daily_recommendation",
) {
  if (ranked.length === 0) return;

  const rows = ranked.map((r) => ({
    user_id: userId,
    recipe_id: r.recipe.id,
    context,
    score: r.score,
  }));
  const { error } = await supabase.from("recommendations").insert(rows);
  if (error) {
    logger.error({ err: error, userId, context, count: rows.length }, "Failed to persist recommendation history");
    throw error;
  }
  logger.debug({ userId, context, count: rows.length }, "Persisted recommendation history");
}

export async function getRecommendations(
  userId: string,
  limit = 10,
  options?: { context?: string; log?: boolean },
): Promise<ScoredRecipe[]> {
  logger.info({ userId, limit, context: options?.context }, "Getting recommendations");
  const [eligible, preferences] = await Promise.all([
    getEligibleRecipes(userId),
    getUserPreferences(userId),
  ]);

  const attributesByRecipe = await getRecipeAttributesBatch(eligible.map((r) => r.id));

  const scored: ScoredRecipe[] = eligible.map((recipe) => ({
    recipe,
    score: scoreRecipe(attributesByRecipe.get(recipe.id) ?? [], preferences),
  }));

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, limit);

  logger.info(
    {
      userId,
      eligibleCount: eligible.length,
      preferenceCount: preferences.length,
      returnedCount: ranked.length,
    },
    "Scored recommendations",
  );

  if (options?.log !== false) {
    await persistRecommendationHistory(userId, ranked, options?.context);
  }

  return ranked;
}

export { scoreRecipe };
