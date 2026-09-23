import { describe, expect, it } from "vitest";
import {
  normalizeAllergies,
  onboardingInputSchema,
} from "./onboarding-constants.js";

describe("normalizeAllergies", () => {
  it("lowercases, trims, and dedupes", () => {
    expect(normalizeAllergies([" Peanut ", "PEANUT", "shellfish", ""])).toEqual([
      "peanut",
      "shellfish",
    ]);
  });
});

describe("onboardingInputSchema", () => {
  it("allows empty arrays for skipped steps", () => {
    const parsed = onboardingInputSchema.parse({
      userId: "00000000-0000-4000-8000-000000000001",
    });
    expect(parsed.dietaryConstraints).toEqual([]);
    expect(parsed.allergies).toEqual([]);
    expect(parsed.cuisines).toEqual([]);
    expect(parsed.mealTypes).toEqual([]);
  });

  it("accepts canonical onboarding values", () => {
    const parsed = onboardingInputSchema.parse({
      userId: "00000000-0000-4000-8000-000000000001",
      dietaryConstraints: ["Vegan", "Gluten-free"],
      allergies: ["peanut"],
      cuisines: ["Italian", "Middle Eastern"],
      mealTypes: ["Breakfast", "Snacks"],
    });
    expect(parsed.cuisines).toContain("Middle Eastern");
    expect(parsed.mealTypes).toEqual(["Breakfast", "Snacks"]);
  });
});
