import { z } from "zod";

/**
 * Types aligned with Spoonacular Get Recipe Information:
 * https://spoonacular.com/food-api/docs#Get-Recipe-Information
 *
 * We keep the full documented surface we care about for ingestion,
 * then project into our DB schema in spoonacular-normalize.ts.
 * Extra undocumented fields are allowed via .passthrough().
 */

const MeasureSchema = z
  .object({
    amount: z.number().optional(),
    unitLong: z.string().optional(),
    unitShort: z.string().optional(),
  })
  .passthrough();

/** extendedIngredients[] item from Get Recipe Information */
export const SpoonacularIngredientSchema = z
  .object({
    id: z.number().optional(),
    aisle: z.string().nullable().optional(),
    amount: z.number().optional(),
    consistency: z.string().optional(),
    image: z.string().nullable().optional(),
    measures: z
      .object({
        metric: MeasureSchema.optional(),
        us: MeasureSchema.optional(),
      })
      .passthrough()
      .optional(),
    meta: z.array(z.string()).optional(),
    name: z.string(),
    original: z.string().optional(),
    originalName: z.string().optional(),
    unit: z.string().optional(),
  })
  .passthrough();

/** nutrition.nutrients[] when includeNutrition=true */
export const SpoonacularNutrientSchema = z
  .object({
    name: z.string(),
    amount: z.number(),
    unit: z.string(),
    percentOfDailyNeeds: z.number().optional(),
  })
  .passthrough();

export const SpoonacularNutritionSchema = z
  .object({
    nutrients: z.array(SpoonacularNutrientSchema).optional(),
    properties: z
      .array(
        z
          .object({
            name: z.string(),
            amount: z.number(),
            unit: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    flavonoids: z.array(z.record(z.unknown())).optional(),
    ingredients: z.array(z.record(z.unknown())).optional(),
    caloricBreakdown: z.record(z.unknown()).optional(),
    weightPerServing: z.record(z.unknown()).optional(),
  })
  .passthrough();

/**
 * Core Get Recipe Information payload.
 * Example in docs uses includeNutrition=false (no nutrition block).
 * With includeNutrition=true, Spoonacular adds `nutrition`.
 */
export const SpoonacularRecipeSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    image: z.string().nullable().optional(),
    imageType: z.string().optional(),
    servings: z.number().nullable().optional(),
    readyInMinutes: z.number().nullable().optional(),
    cookingMinutes: z.number().nullable().optional(),
    preparationMinutes: z.number().nullable().optional(),
    license: z.string().optional(),
    sourceName: z.string().optional(),
    sourceUrl: z.string().nullable().optional(),
    spoonacularSourceUrl: z.string().nullable().optional(),
    healthScore: z.number().optional(),
    spoonacularScore: z.number().optional(),
    pricePerServing: z.number().optional(),
    analyzedInstructions: z.array(z.unknown()).optional(),
    cheap: z.boolean().optional(),
    creditsText: z.string().optional(),
    cuisines: z.array(z.string()).optional(),
    dairyFree: z.boolean().optional(),
    diets: z.array(z.string()).optional(),
    gaps: z.string().optional(),
    glutenFree: z.boolean().optional(),
    instructions: z.string().nullable().optional(),
    ketogenic: z.boolean().optional(),
    lowFodmap: z.boolean().optional(),
    occasions: z.array(z.string()).optional(),
    sustainable: z.boolean().optional(),
    vegan: z.boolean().optional(),
    vegetarian: z.boolean().optional(),
    veryHealthy: z.boolean().optional(),
    veryPopular: z.boolean().optional(),
    whole30: z.boolean().optional(),
    weightWatcherSmartPoints: z.number().optional(),
    dishTypes: z.array(z.string()).optional(),
    extendedIngredients: z.array(SpoonacularIngredientSchema).optional(),
    summary: z.string().nullable().optional(),
    winePairing: z.record(z.unknown()).optional(),
    /** Present only when includeNutrition=true */
    nutrition: SpoonacularNutritionSchema.optional(),
  })
  .passthrough();

export type SpoonacularIngredient = z.infer<typeof SpoonacularIngredientSchema>;
export type SpoonacularNutrient = z.infer<typeof SpoonacularNutrientSchema>;
export type SpoonacularRecipe = z.infer<typeof SpoonacularRecipeSchema>;

const SPOONACULAR_BASE = "https://api.spoonacular.com";

function requireApiKey(apiKey: string | undefined): string {
  if (!apiKey?.trim()) {
    throw new Error(
      "SPOONACULAR_API_KEY is required for recipe ingestion. Set it in .env.",
    );
  }
  return apiKey.trim();
}

async function spoonacularGet(
  path: string,
  apiKey: string,
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<unknown> {
  const url = new URL(`${SPOONACULAR_BASE}${path}`);
  url.searchParams.set("apiKey", apiKey);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Spoonacular ${path} failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return res.json();
}

function parseRecipe(data: unknown, context: string): SpoonacularRecipe {
  const parsed = SpoonacularRecipeSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid Spoonacular recipe payload (${context}): ${parsed.error.errors
        .slice(0, 3)
        .map((e) => e.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/** GET /recipes/{id}/information */
export async function fetchRecipeInformation(
  recipeId: number,
  apiKey: string,
  includeNutrition = true,
): Promise<SpoonacularRecipe> {
  const key = requireApiKey(apiKey);
  const data = await spoonacularGet(`/recipes/${recipeId}/information`, key, {
    includeNutrition,
  });
  return parseRecipe(data, `id=${recipeId}`);
}

/** GET /recipes/informationBulk?ids=1,2,3 */
export async function fetchRecipeInformationBulk(
  recipeIds: number[],
  apiKey: string,
  includeNutrition = true,
): Promise<SpoonacularRecipe[]> {
  if (recipeIds.length === 0) return [];
  const key = requireApiKey(apiKey);
  const data = await spoonacularGet(`/recipes/informationBulk`, key, {
    ids: recipeIds.join(","),
    includeNutrition,
  });
  if (!Array.isArray(data)) {
    throw new Error("Spoonacular informationBulk did not return an array");
  }
  return data.map((item, i) => parseRecipe(item, `bulk[${i}]`));
}

/** GET /recipes/random — returns { recipes: [...] } */
export async function fetchRandomRecipes(
  apiKey: string,
  number = 10,
  tags?: string,
): Promise<SpoonacularRecipe[]> {
  const key = requireApiKey(apiKey);
  const data = await spoonacularGet(`/recipes/random`, key, {
    number,
    "include-tags": tags,
    includeNutrition: true,
  });
  const recipes = (data as { recipes?: unknown }).recipes;
  if (!Array.isArray(recipes)) {
    throw new Error("Spoonacular random did not return recipes[]");
  }
  return recipes.map((item, i) => parseRecipe(item, `random[${i}]`));
}

/**
 * GET /recipes/complexSearch — thin results; hydrate via informationBulk.
 */
export async function searchRecipeIds(
  apiKey: string,
  params: {
    query?: string;
    number?: number;
    cuisine?: string;
    diet?: string;
    type?: string;
    intolerances?: string;
  },
): Promise<number[]> {
  const key = requireApiKey(apiKey);
  const data = await spoonacularGet(`/recipes/complexSearch`, key, {
    query: params.query,
    number: params.number ?? 10,
    cuisine: params.cuisine,
    diet: params.diet,
    type: params.type,
    intolerances: params.intolerances,
  });
  const results = (data as { results?: Array<{ id: number }> }).results ?? [];
  return results.map((r) => r.id).filter((id) => Number.isFinite(id));
}
