import type { RecipeAttribute, UserPreference } from "../types/index.js";

/**
 * Weighted scoring: sums the user's preference weight for every
 * (attribute_type, attribute_value) pair the recipe carries.
 * Deterministic and fully configurable — no LLM in this function.
 */
export function scoreRecipe(
  attributes: RecipeAttribute[],
  preferences: UserPreference[],
): number {
  const prefLookup = new Map(
    preferences.map((p) => [`${p.preference_type}:${p.value}`, p.weight]),
  );

  let score = 0;
  for (const attr of attributes) {
    const key = `${attr.attribute_type}:${attr.attribute_value}`;
    score += prefLookup.get(key) ?? 0;
  }
  return score;
}

/**
 * Pure hard-filter helper for unit tests / offline demos.
 * Mirrors the SQL get_eligible_recipes allergy + diet logic.
 */
export function isRecipeEligible(params: {
  ingredients: string[];
  vegan: boolean;
  vegetarian: boolean;
  gluten_free: boolean;
  dairy_free: boolean;
  dietCategories: string[];
  constraints: Array<{ constraint_type: string; value: string }>;
}): boolean {
  const {
    ingredients,
    vegan,
    vegetarian,
    gluten_free,
    dairy_free,
    dietCategories,
    constraints,
  } = params;

  for (const c of constraints) {
    if (c.constraint_type === "allergy" || c.constraint_type === "excluded_ingredient") {
      const needle = c.value.toLowerCase();
      if (ingredients.some((ing) => ing.toLowerCase().includes(needle))) {
        return false;
      }
    }
  }

  const dietConstraints = constraints.filter((c) => c.constraint_type === "diet");
  if (dietConstraints.length === 0) return true;

  return dietConstraints.some((c) => {
    const value = c.value.toLowerCase();
    if (value === "vegan") return vegan;
    if (value === "vegetarian") return vegetarian;
    if (value === "gluten_free" || value === "gluten-free") return gluten_free;
    if (value === "dairy_free" || value === "dairy-free") return dairy_free;
    return dietCategories.some((d) => d.toLowerCase() === value);
  });
}

export const WEIGHT_STEP = 0.5;
export const WEIGHT_MIN = -5;
export const WEIGHT_MAX = 5;

/** Clamp preference weights so feedback cannot dominate forever. */
export function clampWeight(weight: number): number {
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, weight));
}

export function weightDeltaFromPolarity(polarity: number): number {
  return polarity * WEIGHT_STEP;
}

/** Map explicit rating (1-5) into a preference polarity when no comment. */
export function polarityFromRating(rating: number): -1 | 0 | 1 {
  if (rating <= 2) return -1;
  if (rating >= 4) return 1;
  return 0;
}
