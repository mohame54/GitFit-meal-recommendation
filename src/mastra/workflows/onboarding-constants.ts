import { z } from "zod";

export const DIETARY_OPTIONS = [
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
] as const;

export const CUISINE_OPTIONS = [
  "Italian",
  "Asian",
  "Mexican",
  "Mediterranean",
  "American",
  "Indian",
  "Middle Eastern",
] as const;

export const MEAL_TYPE_OPTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
] as const;

export const dietaryConstraintSchema = z.enum(DIETARY_OPTIONS);
export const cuisinePreferenceSchema = z.enum(CUISINE_OPTIONS);
export const mealTypePreferenceSchema = z.enum(MEAL_TYPE_OPTIONS);

export const onboardingInputSchema = z.object({
  userId: z.string().uuid(),
  dietaryConstraints: z.array(dietaryConstraintSchema).default([]),
  allergies: z.array(z.string().trim().min(1)).default([]),
  cuisines: z.array(cuisinePreferenceSchema).default([]),
  mealTypes: z.array(mealTypePreferenceSchema).default([]),
});

export const onboardingOutputSchema = z.object({
  status: z.literal("ok"),
  saved: z.object({
    dietaryConstraints: z.number().int().nonnegative(),
    allergies: z.number().int().nonnegative(),
    cuisines: z.number().int().nonnegative(),
    mealTypes: z.number().int().nonnegative(),
  }),
  onboardingComplete: z.literal(true),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export type OnboardingOutput = z.infer<typeof onboardingOutputSchema>;

/** Normalize free-text allergy tags to lowercase trimmed values. */
export function normalizeAllergy(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeAllergies(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = normalizeAllergy(raw);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
