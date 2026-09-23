import { z } from "@hono/zod-openapi";

export const PreferenceSchema = z
  .object({
    preference_type: z.string(),
    value: z.string(),
    weight: z.number(),
  })
  .openapi("UserPreference");

export const UpsertPreferenceBodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    preference_type: z.enum([
      "cuisine",
      "ingredient",
      "spice_level",
      "meal_type",
      "prep_time",
      "texture",
    ]),
    value: z.string().trim().min(1),
    weight: z.number().min(-5).max(5),
  })
  .openapi("UpsertPreferenceBody");

export const PreferencesQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export const DeletePreferenceQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  preference_type: z.string().min(1),
  value: z.string().min(1),
});
