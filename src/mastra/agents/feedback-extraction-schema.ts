import { z } from "zod";

/**
 * Gemini function/response enums must be strings. Numeric literals are sent as
 * `enum: [-1, 0, 1]` and rejected with INVALID_ARGUMENT. The model sees
 * "-1" | "0" | "1"; parsed output is still -1 | 0 | 1.
 */
export const polaritySchema = z
  .preprocess((value) => {
    if (value === -1 || value === 0 || value === 1) return String(value);
    return value;
  }, z.enum(["-1", "0", "1"]).describe("Preference direction: -1 dislike, 0 neutral, 1 like"))
  .transform((value): -1 | 0 | 1 => Number(value) as -1 | 0 | 1);

export const feedbackExtractionSchema = z.object({
  sentiment: z.enum(["positive", "negative", "mixed", "neutral"]),
  attributes: z.array(
    z.object({
      preference_type: z.enum([
        "cuisine",
        "ingredient",
        "spice_level",
        "meal_type",
        "prep_time",
        "texture",
      ]),
      value: z.string(),
      polarity: polaritySchema,
    }),
  ),
});
