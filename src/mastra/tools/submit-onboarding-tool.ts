import { z } from "zod";
import {
  cuisinePreferenceSchema,
  dietaryConstraintSchema,
  mealTypePreferenceSchema,
  normalizeAllergies,
} from "../workflows/onboarding-constants.js";
import { runOnboardingWorkflow } from "../workflows/onboarding-workflow.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z.object({
  dietaryConstraints: z
    .array(dietaryConstraintSchema)
    .default([])
    .describe("Selected diets, or [] if skipped"),
  allergies: z.array(z.string()).default([]).describe("Allergy tags, or [] if skipped"),
  cuisines: z
    .array(cuisinePreferenceSchema)
    .default([])
    .describe("Selected cuisines, or [] if skipped"),
  mealTypes: z
    .array(mealTypePreferenceSchema)
    .default([])
    .describe("Selected meal types, or [] if skipped"),
});

const outputSchema = z.object({
  status: z.literal("ok"),
  saved: z.object({
    dietaryConstraints: z.number(),
    allergies: z.number(),
    cuisines: z.number(),
    mealTypes: z.number(),
  }),
  onboardingComplete: z.literal(true),
});

export const submitOnboardingTool = new BaseTool({
  id: "submit-onboarding",
  description:
    "Persist onboarding answers (dietary constraints, allergies, cuisines, meal types) " +
    "for the signed-in user and mark onboarding_complete in user metadata. " +
    "Empty arrays mean the step was skipped. Call only after the user confirms Finish.",
  inputSchema,
  outputSchema,
  run: async (input, actor) => {
    return runOnboardingWorkflow({
      userId: actor.userId,
      authUserId: actor.authUserId,
      dietaryConstraints: input.dietaryConstraints ?? [],
      allergies: normalizeAllergies(input.allergies ?? []),
      cuisines: input.cuisines ?? [],
      mealTypes: input.mealTypes ?? [],
    });
  },
}).tool;
