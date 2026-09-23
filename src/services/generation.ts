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
    maxSteps: 1,
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
  const { data, error } = await supabase
    .from("generated_recipes")
    .insert({
      user_id: params.userId,
      title: payload.title,
      ingredients: payload.ingredients,
      steps: payload.steps,
      tags: payload.tags,
      calories: payload.calories ?? null,
      ready_in_minutes: payload.ready_in_minutes ?? null,
      servings: payload.servings ?? null,
      raw_payload: payload,
      is_valid: true,
    })
    .select(
      "id, user_id, title, ingredients, steps, tags, calories, ready_in_minutes, servings, is_valid, created_at",
    )
    .single();
  if (error) {
    logger.error(
      { err: error, userId: params.userId, title: payload.title },
      "Failed to persist generated recipe",
    );
    throw error;
  }

  logger.info(
    { userId: params.userId, recipeId: data.id, title: data.title },
    "Generated recipe",
  );
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    ingredients: data.ingredients,
    steps: data.steps,
    tags: data.tags,
    calories: data.calories,
    ready_in_minutes: data.ready_in_minutes,
    servings: data.servings,
    is_valid: data.is_valid,
    created_at: data.created_at,
  };
}

export async function listGeneratedRecipes(
  userId: string,
  limit = 20,
): Promise<GeneratedRecipeRecord[]> {
  logger.debug({ userId, limit }, "Listing generated recipes");
  const { data, error } = await supabase
    .from("generated_recipes")
    .select(
      "id, user_id, title, ingredients, steps, tags, calories, ready_in_minutes, servings, is_valid, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error, userId, limit }, "Failed to list generated recipes");
    throw error;
  }
  logger.debug({ userId, count: data?.length ?? 0 }, "Listed generated recipes");
  return (data ?? []) as GeneratedRecipeRecord[];
}
