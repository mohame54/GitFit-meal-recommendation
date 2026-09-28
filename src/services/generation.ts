import { supabase } from "../db/client.js";
import { parseEnv } from "../env-parser.js";
import { createServiceLogger } from "../lib/logger.js";
import { recipeGenerationAgent } from "../mastra/agents/recipe-generation-agent.js";
import type { GeneratedRecipePayload, GeneratedRecipeRecord } from "../types/index.js";
import {
  generatedRecipeSchema,
  validateGeneratedRecipe,
} from "./generation-validation.js";
import { listConstraints } from "./constraints.js";
import { listPreferences } from "./preferences.js";

export { generatedRecipeSchema, validateGeneratedRecipe };

const logger = createServiceLogger("generation");

const GENERATED_SOURCE = "generated";
const GENERATED_CONTEXT = "generated_recipe";
const GENERATED_CONTENT_TYPE = "recipe";
const GENERATED_SCHEMA_VERSION = 1;

function dietFlags(tags: Array<{ value: string }>) {
  const values = new Set(tags.map((tag) => tag.value.toLowerCase()));
  const vegan = values.has("vegan");
  return {
    vegan,
    vegetarian: vegan || values.has("vegetarian"),
    gluten_free: values.has("gluten_free") || values.has("gluten-free"),
    dairy_free: values.has("dairy_free") || values.has("dairy-free"),
  };
}

function stepsFromInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((step): step is string => typeof step === "string" && step.length > 0);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((step): step is string => typeof step === "string" && step.length > 0);
    }
  } catch {
    // Plain text instructions, one step per line.
  }
  return value
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
}

function buildPrompt(params: {
  userId: string;
  prompt?: string;
  constraints: Array<{ constraint_type: string; value: string }>;
  preferences: Array<{ preference_type: string; value: string; weight: number }>;
}): string {
  const hard = params.constraints
    .map((c) => `- ${c.constraint_type}: ${c.value}`)
    .join("\n");
  const soft = params.preferences
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12)
    .map((p) => `- ${p.preference_type}=${p.value} (weight ${p.weight})`)
    .join("\n");

  return [
    "Generate one personalized recipe as structured JSON matching the schema.",
    "Respect ALL hard constraints (allergies, diet, excluded ingredients).",
    "Prefer soft preferences with higher weights.",
    params.prompt ? `User request: ${params.prompt}` : "User request: invent a fitting meal.",
    "",
    "Hard constraints:",
    hard || "(none)",
    "",
    "Soft preferences:",
    soft || "(none)",
  ].join("\n");
}

export async function generateRecipeForUser(params: {
  userId: string;
  prompt?: string;
}): Promise<GeneratedRecipeRecord> {
  logger.info({ userId: params.userId, hasPrompt: Boolean(params.prompt) }, "Generating recipe");
  const env = parseEnv();
  const [constraints, preferences] = await Promise.all([
    listConstraints(params.userId),
    listPreferences(params.userId),
  ]);
  logger.debug(
    {
      userId: params.userId,
      constraintCount: constraints.length,
      preferenceCount: preferences.length,
    },
    "Loaded generation context",
  );

  const prompt = buildPrompt({
    userId: params.userId,
    prompt: params.prompt,
    constraints,
    preferences,
  });

  const response = await recipeGenerationAgent.generate(prompt, {
    maxSteps: env.LLM_MAX_STEPS ?? 1,
    modelSettings: {
      temperature: env.LLM_TEMPERATURE ?? 0.4,
      maxOutputTokens: env.LLM_MAX_TOKENS ?? 1200,
    },
    structuredOutput: {
      schema: generatedRecipeSchema,
      jsonPromptInjection: "auto",
    },
  });

  const validation = validateGeneratedRecipe(response.object);
  if (!validation.ok) {
    logger.error(
      { userId: params.userId, validationError: validation.error },
      "Generated recipe failed validation",
    );
    throw new Error(`Generated recipe failed validation: ${validation.error}`);
  }

  const value = validation.value;

  for (const c of constraints) {
    if (c.constraint_type === "allergy" || c.constraint_type === "excluded_ingredient") {
      const needle = c.value.toLowerCase();
      const hit = value.ingredients.some((ing) => ing.name.toLowerCase().includes(needle));
      if (hit) {
        logger.error(
          {
            userId: params.userId,
            constraintType: c.constraint_type,
            value: c.value,
            title: value.title,
          },
          "Generated recipe violates hard constraint",
        );
        throw new Error(
          `Generated recipe violates hard constraint ${c.constraint_type}=${c.value}`,
        );
      }
    }
  }

  const payload: GeneratedRecipePayload = value;
  const { data: generated, error: generatedError } = await supabase
    .from("generated_content")
    .insert({
      user_id: params.userId,
      content_type: GENERATED_CONTENT_TYPE,
      prompt_context: prompt,
      raw_output: payload,
      schema_version: GENERATED_SCHEMA_VERSION,
      is_valid: true,
    })
    .select("id, created_at")
    .single();
  if (generatedError) {
    logger.error(
      { err: generatedError, userId: params.userId, title: payload.title },
      "Failed to persist generated content",
    );
    throw generatedError;
  }

  const flags = dietFlags(payload.tags);
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      external_id: generated.id,
      source_api: GENERATED_SOURCE,
      title: payload.title,
      image_url: null,
      ready_in_minutes: payload.ready_in_minutes ?? null,
      servings: payload.servings ?? null,
      calories: payload.calories ?? null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      ...flags,
      instructions: payload.steps.join("\n"),
    })
    .select("id")
    .single();
  if (recipeError) {
    logger.error(
      { err: recipeError, userId: params.userId, title: payload.title },
      "Failed to persist generated recipe",
    );
    throw recipeError;
  }

  const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(
    payload.ingredients.map((ingredient) => ({
      recipe_id: recipe.id,
      name: ingredient.name,
      amount: ingredient.amount ?? null,
    })),
  );
  if (ingredientError) {
    logger.error({ err: ingredientError, recipeId: recipe.id }, "Failed to persist generated ingredients");
    throw ingredientError;
  }

  if (payload.tags.length > 0) {
    const { error: attributeError } = await supabase.from("recipe_attributes").insert(
      payload.tags.map((tag) => ({
        recipe_id: recipe.id,
        attribute_type: tag.type,
        attribute_value: tag.value,
      })),
    );
    if (attributeError) {
      logger.error({ err: attributeError, recipeId: recipe.id }, "Failed to persist generated attributes");
      throw attributeError;
    }
  }

  const { error: recommendationError } = await supabase.from("recommendations").insert({
    user_id: params.userId,
    recipe_id: recipe.id,
    context: GENERATED_CONTEXT,
    score: 0,
  });
  if (recommendationError) {
    logger.error(
      { err: recommendationError, userId: params.userId, recipeId: recipe.id },
      "Failed to persist generated recommendation",
    );
    throw recommendationError;
  }

  logger.info(
    { userId: params.userId, recipeId: recipe.id, title: payload.title },
    "Generated recipe",
  );
  return {
    id: recipe.id,
    user_id: params.userId,
    title: payload.title,
    ingredients: payload.ingredients,
    steps: payload.steps,
    tags: payload.tags,
    calories: payload.calories ?? null,
    ready_in_minutes: payload.ready_in_minutes ?? null,
    servings: payload.servings ?? null,
    is_valid: true,
    created_at: generated.created_at,
  };
}

export async function listGeneratedRecipes(
  userId: string,
  limit = 20,
): Promise<GeneratedRecipeRecord[]> {
  logger.debug({ userId, limit }, "Listing generated recipes");
  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "shown_at, recipe:recipes(id, title, calories, ready_in_minutes, servings, instructions)",
    )
    .eq("user_id", userId)
    .eq("context", GENERATED_CONTEXT)
    .order("shown_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error, userId, limit }, "Failed to list generated recipes");
    throw error;
  }

  const rows = (data ?? []).flatMap((row) => {
    const recipe = Array.isArray(row.recipe) ? row.recipe[0] : row.recipe;
    if (!recipe) return [];
    return [{ shownAt: row.shown_at as string, recipe }];
  });
  const recipeIds = rows.map((row) => row.recipe.id as string);

  const [ingredientsResult, attributesResult] = await Promise.all([
    recipeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("recipe_ingredients")
          .select("recipe_id, name, amount")
          .in("recipe_id", recipeIds),
    recipeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("recipe_attributes")
          .select("recipe_id, attribute_type, attribute_value")
          .in("recipe_id", recipeIds),
  ]);
  if (ingredientsResult.error) {
    logger.error({ err: ingredientsResult.error, userId }, "Failed to list generated ingredients");
    throw ingredientsResult.error;
  }
  if (attributesResult.error) {
    logger.error({ err: attributesResult.error, userId }, "Failed to list generated attributes");
    throw attributesResult.error;
  }

  const ingredientsByRecipe = new Map<string, GeneratedRecipeRecord["ingredients"]>();
  for (const ingredient of ingredientsResult.data ?? []) {
    const list = ingredientsByRecipe.get(ingredient.recipe_id) ?? [];
    list.push({
      name: ingredient.name,
      amount: ingredient.amount ?? undefined,
    });
    ingredientsByRecipe.set(ingredient.recipe_id, list);
  }
  const tagsByRecipe = new Map<string, GeneratedRecipeRecord["tags"]>();
  for (const attribute of attributesResult.data ?? []) {
    const list = tagsByRecipe.get(attribute.recipe_id) ?? [];
    list.push({ type: attribute.attribute_type, value: attribute.attribute_value });
    tagsByRecipe.set(attribute.recipe_id, list);
  }

  const recipes = rows.map((row) => {
    const recipe = row.recipe;
    const recipeId = recipe.id as string;
    return {
      id: recipeId,
      user_id: userId,
      title: recipe.title as string,
      ingredients: ingredientsByRecipe.get(recipeId) ?? [],
      steps: stepsFromInstructions(recipe.instructions),
      tags: tagsByRecipe.get(recipeId) ?? [],
      calories: (recipe.calories as number | null) ?? null,
      ready_in_minutes: (recipe.ready_in_minutes as number | null) ?? null,
      servings: (recipe.servings as number | null) ?? null,
      is_valid: true,
      created_at: row.shownAt,
    };
  });
  logger.debug({ userId, count: recipes.length }, "Listed generated recipes");
  return recipes;
}
