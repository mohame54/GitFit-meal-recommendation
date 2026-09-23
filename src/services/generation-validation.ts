import { z } from "zod";

/**
 * Pure schema validation for AI-generated recipes.
 * Kept separate from generation.ts so unit tests do not load Mastra/DB.
 */
export const generatedRecipeSchema = z.object({
  title: z.string().min(1),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.string().optional(),
      }),
    )
    .min(1),
  steps: z.array(z.string().min(1)).min(1),
  tags: z
    .array(
      z.object({
        type: z.enum([
          "cuisine",
          "ingredient",
          "spice_level",
          "meal_type",
          "prep_time",
          "texture",
        ]),
        value: z.string().min(1),
      }),
    )
    .default([]),
  calories: z.number().nullable().optional(),
  ready_in_minutes: z.number().int().positive().nullable().optional(),
  servings: z.number().int().positive().nullable().optional(),
});

export type GeneratedRecipeValidated = z.infer<typeof generatedRecipeSchema>;

export function validateGeneratedRecipe(data: unknown): {
  ok: true;
  value: GeneratedRecipeValidated;
} | { ok: false; error: string } {
  const parsed = generatedRecipeSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join("; ") };
  }
  return { ok: true, value: parsed.data };
}
