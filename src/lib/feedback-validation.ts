import type { ExtractedFeedback } from "../types/index.js";

export const ALLOWED_PREFERENCE_TYPES = new Set([
  "cuisine",
  "ingredient",
  "spice_level",
  "meal_type",
  "prep_time",
  "texture",
]);

/** Validates the LLM's JSON output before it's trusted anywhere downstream. */
export function validateExtraction(data: unknown): data is ExtractedFeedback {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;

  const validSentiments = ["positive", "negative", "mixed", "neutral"];
  if (typeof d.sentiment !== "string" || !validSentiments.includes(d.sentiment)) {
    return false;
  }
  if (!Array.isArray(d.attributes)) return false;

  for (const attr of d.attributes) {
    if (typeof attr !== "object" || attr === null) return false;
    const a = attr as Record<string, unknown>;
    if (
      typeof a.preference_type !== "string" ||
      !ALLOWED_PREFERENCE_TYPES.has(a.preference_type)
    ) {
      return false;
    }
    if (typeof a.value !== "string" || a.value.length === 0) return false;
    if (![-1, 0, 1].includes(a.polarity as number)) return false;
  }
  return true;
}
