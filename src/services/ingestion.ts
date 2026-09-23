import { parseEnv } from "../env-parser.js";
import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import {
  fetchRandomRecipes,
  fetchRecipeInformationBulk,
  searchRecipeIds,
  type SpoonacularRecipe,
} from "../lib/spoonacular.js";
import {
  normalizeSpoonacularRecipe,
  type NormalizedRecipe,
} from "./spoonacular-normalize.js";
import type { Recipe } from "../types/index.js";

const logger = createServiceLogger("ingestion");

export type IngestResult = {
  upserted: number;
  recipeIds: string[];
  externalIds: string[];
};

function getSpoonacularApiKey(): string {
  const env = parseEnv();
  const key = env.SPOONACULAR_API_KEY;
  if (!key) {
    logger.error("SPOONACULAR_API_KEY is not configured");
    throw new Error("SPOONACULAR_API_KEY is not configured");
  }
  return key;
}

async function upsertCategory(type: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("categories")
    .upsert({ type, name }, { onConflict: "type,name" })
    .select("id")
    .single();
  if (error) {
    logger.error({ err: error, type, name }, "Failed to upsert category");
    throw error;
  }
  return data.id as string;
}

/**
 * Persist a normalized Spoonacular recipe into our cache tables.
 * Idempotent on (source_api, external_id).
 */
export async function upsertNormalizedRecipe(
  normalized: NormalizedRecipe,
): Promise<Recipe> {
  logger.debug(
    { externalId: normalized.external_id, title: normalized.title },
    "Upserting normalized recipe",
  );
  const { data: recipe, error } = await supabase
    .from("recipes")
    .upsert(
      {
        external_id: normalized.external_id,
        source_api: normalized.source_api,
        title: normalized.title,
        image_url: normalized.image_url,
        ready_in_minutes: normalized.ready_in_minutes,
        servings: normalized.servings,
        calories: normalized.calories,
        protein_g: normalized.protein_g,
        carbs_g: normalized.carbs_g,
        fat_g: normalized.fat_g,
        vegan: normalized.vegan,
        vegetarian: normalized.vegetarian,
        gluten_free: normalized.gluten_free,
        dairy_free: normalized.dairy_free,
      },
      { onConflict: "source_api,external_id" },
    )
    .select("*")
    .single();
  if (error) {
    logger.error(
      { err: error, externalId: normalized.external_id, title: normalized.title },
      "Failed to upsert recipe",
    );
    throw error;
  }

  const recipeId = recipe.id as string;

  // Replace related rows so re-ingest stays fresh
  const deletes = await Promise.all([
    supabase.from("recipe_attributes").delete().eq("recipe_id", recipeId),
    supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId),
    supabase.from("recipe_categories").delete().eq("recipe_id", recipeId),
  ]);
  for (const d of deletes) {
    if (d.error) {
      logger.error({ err: d.error, recipeId }, "Failed to clear related recipe rows");
      throw d.error;
    }
  }

  if (normalized.attributes.length > 0) {
    const { error: attrError } = await supabase.from("recipe_attributes").insert(
      normalized.attributes.map((a) => ({
        recipe_id: recipeId,
        attribute_type: a.attribute_type,
        attribute_value: a.attribute_value,
      })),
    );
    if (attrError) {
      logger.error({ err: attrError, recipeId }, "Failed to insert recipe attributes");
      throw attrError;
    }
  }

  if (normalized.ingredients.length > 0) {
    const { error: ingError } = await supabase.from("recipe_ingredients").insert(
      normalized.ingredients.map((i) => ({
        recipe_id: recipeId,
        name: i.name,
        amount: i.amount,
      })),
    );
    if (ingError) {
      logger.error({ err: ingError, recipeId }, "Failed to insert recipe ingredients");
      throw ingError;
    }
  }

  const categoryIds: string[] = [];
  for (const link of normalized.categoryLinks) {
    categoryIds.push(await upsertCategory(link.type, link.name));
  }
  const uniqueCategoryIds = [...new Set(categoryIds)];
  if (uniqueCategoryIds.length > 0) {
    const { error: catError } = await supabase.from("recipe_categories").insert(
      uniqueCategoryIds.map((category_id) => ({
        recipe_id: recipeId,
        category_id,
      })),
    );
    if (catError) {
      logger.error({ err: catError, recipeId }, "Failed to insert recipe categories");
      throw catError;
    }
  }

  return recipe as Recipe;
}

async function persistRecipes(rawRecipes: SpoonacularRecipe[]): Promise<IngestResult> {
  const recipeIds: string[] = [];
  const externalIds: string[] = [];

  logger.info({ count: rawRecipes.length }, "Persisting Spoonacular recipes");
  for (const raw of rawRecipes) {
    const normalized = normalizeSpoonacularRecipe(raw);
    const recipe = await upsertNormalizedRecipe(normalized);
    recipeIds.push(recipe.id);
    externalIds.push(normalized.external_id);
  }

  logger.info({ upserted: recipeIds.length }, "Persisted Spoonacular recipes");
  return { upserted: recipeIds.length, recipeIds, externalIds };
}

/** Ingest specific Spoonacular recipe ids (hydrated via informationBulk). */
export async function ingestSpoonacularByIds(ids: number[]): Promise<IngestResult> {
  logger.info({ requestedCount: ids.length }, "Ingesting Spoonacular recipes by id");
  const apiKey = getSpoonacularApiKey();
  const unique = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0);
  if (unique.length === 0) {
    logger.warn({ requestedCount: ids.length }, "No valid Spoonacular ids to ingest");
    return { upserted: 0, recipeIds: [], externalIds: [] };
  }

  // Spoonacular bulk is efficient; chunk to stay under URL limits
  const chunkSize = 20;
  const all: SpoonacularRecipe[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    logger.debug({ chunkStart: i, chunkSize: chunk.length }, "Fetching Spoonacular recipe bulk");
    const recipes = await fetchRecipeInformationBulk(chunk, apiKey, true);
    all.push(...recipes);
  }
  return persistRecipes(all);
}

/** Pull random Spoonacular recipes and cache them locally. */
export async function ingestRandomSpoonacularRecipes(
  number = 10,
  tags?: string,
): Promise<IngestResult> {
  logger.info({ number, tags }, "Ingesting random Spoonacular recipes");
  const apiKey = getSpoonacularApiKey();
  const recipes = await fetchRandomRecipes(apiKey, Math.min(Math.max(number, 1), 100), tags);
  // Random endpoint may omit full nutrition; re-hydrate via bulk when needed
  const missingNutrition = recipes.filter((r) => !r.nutrition?.nutrients?.length);
  if (missingNutrition.length > 0) {
    logger.debug(
      { missingNutritionCount: missingNutrition.length },
      "Hydrating recipes missing nutrition",
    );
    const hydrated = await fetchRecipeInformationBulk(
      missingNutrition.map((r) => r.id),
      apiKey,
      true,
    );
    const byId = new Map(hydrated.map((r) => [r.id, r]));
    for (let i = 0; i < recipes.length; i++) {
      const full = byId.get(recipes[i].id);
      if (full) recipes[i] = full;
    }
  }
  return persistRecipes(recipes);
}

/** Search Spoonacular, then cache full recipe information locally. */
export async function ingestSpoonacularSearch(params: {
  query?: string;
  number?: number;
  cuisine?: string;
  diet?: string;
  type?: string;
  intolerances?: string;
}): Promise<IngestResult> {
  logger.info(params, "Ingesting Spoonacular search results");
  const apiKey = getSpoonacularApiKey();
  const ids = await searchRecipeIds(apiKey, params);
  logger.debug({ resultCount: ids.length }, "Spoonacular search returned ids");
  return ingestSpoonacularByIds(ids);
}

/**
 * Look up a recipe by Spoonacular external id in our cache.
 * Does NOT call Spoonacular — recommendations always use this local path.
 */
export async function getCachedSpoonacularRecipe(
  spoonacularId: number | string,
): Promise<Recipe | null> {
  logger.debug({ spoonacularId }, "Looking up cached Spoonacular recipe");
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("source_api", "spoonacular")
    .eq("external_id", String(spoonacularId))
    .maybeSingle();
  if (error) {
    logger.error({ err: error, spoonacularId }, "Failed to look up cached Spoonacular recipe");
    throw error;
  }
  if (!data) {
    logger.debug({ spoonacularId }, "Cached Spoonacular recipe not found");
    return null;
  }
  return data;
}
