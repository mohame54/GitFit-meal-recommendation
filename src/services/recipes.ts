import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import type { Recipe, RecipeAttribute } from "../types/index.js";

const logger = createServiceLogger("recipes");

export async function listRecipes(limit = 50, offset = 0): Promise<Recipe[]> {
  logger.debug({ limit, offset }, "Listing recipes");
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("title", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    logger.error({ err: error, limit, offset }, "Failed to list recipes");
    throw error;
  }
  logger.debug({ limit, offset, count: data?.length ?? 0 }, "Listed recipes");
  return data ?? [];
}

export async function getRecipe(recipeId: string): Promise<{
  recipe: Recipe;
  attributes: RecipeAttribute[];
  ingredients: Array<{ name: string; amount: string | null }>;
} | null> {
  logger.debug({ recipeId }, "Getting recipe");
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();
  if (error) {
    logger.error({ err: error, recipeId }, "Failed to get recipe");
    throw error;
  }
  if (!recipe) {
    logger.debug({ recipeId }, "Recipe not found");
    return null;
  }

  const [attrs, ingredients] = await Promise.all([
    supabase
      .from("recipe_attributes")
      .select("attribute_type, attribute_value")
      .eq("recipe_id", recipeId),
    supabase
      .from("recipe_ingredients")
      .select("name, amount")
      .eq("recipe_id", recipeId),
  ]);

  if (attrs.error) {
    logger.error({ err: attrs.error, recipeId }, "Failed to get recipe attributes");
    throw attrs.error;
  }
  if (ingredients.error) {
    logger.error({ err: ingredients.error, recipeId }, "Failed to get recipe ingredients");
    throw ingredients.error;
  }

  logger.debug(
    {
      recipeId,
      attributeCount: attrs.data?.length ?? 0,
      ingredientCount: ingredients.data?.length ?? 0,
    },
    "Got recipe",
  );
  return {
    recipe,
    attributes: attrs.data ?? [],
    ingredients: ingredients.data ?? [],
  };
}
