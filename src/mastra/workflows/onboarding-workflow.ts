import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { supabase } from "../../db/client.js";
import { createServiceLogger } from "../../lib/logger.js";
import { upsertConstraint } from "../../services/constraints.js";
import { upsertPreference } from "../../services/preferences.js";
import {
  normalizeAllergies,
  onboardingInputSchema,
  onboardingOutputSchema,
  type OnboardingInput,
  type OnboardingOutput,
} from "./onboarding-constants.js";

const logger = createServiceLogger("onboarding-workflow");

const saveDietaryStep = createStep({
  id: "save-dietary-constraints",
  description: "Persist dietary constraints (diet type)",
  inputSchema: onboardingInputSchema,
  outputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
  }),
  execute: async ({ inputData }) => {
    let savedDietary = 0;
    for (const value of inputData.dietaryConstraints) {
      await upsertConstraint(inputData.userId, {
        constraint_type: "diet",
        value,
      });
      savedDietary += 1;
    }
    logger.info(
      { userId: inputData.userId, savedDietary },
      "Saved dietary constraints",
    );
    return { ...inputData, savedDietary };
  },
});

const saveAllergiesStep = createStep({
  id: "save-allergies",
  description: "Persist allergy constraints",
  inputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
  }),
  outputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
  }),
  execute: async ({ inputData }) => {
    const allergies = normalizeAllergies(inputData.allergies);
    let savedAllergies = 0;
    for (const value of allergies) {
      await upsertConstraint(inputData.userId, {
        constraint_type: "allergy",
        value,
      });
      savedAllergies += 1;
    }
    logger.info(
      { userId: inputData.userId, savedAllergies },
      "Saved allergies",
    );
    return { ...inputData, allergies, savedAllergies };
  },
});

const saveCuisinesStep = createStep({
  id: "save-cuisines",
  description: "Persist cuisine preferences with weight 2",
  inputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
  }),
  outputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
    savedCuisines: z.number().int().nonnegative(),
  }),
  execute: async ({ inputData }) => {
    let savedCuisines = 0;
    for (const value of inputData.cuisines) {
      await upsertPreference(inputData.userId, {
        preference_type: "cuisine",
        value,
        weight: 2,
      });
      savedCuisines += 1;
    }
    logger.info(
      { userId: inputData.userId, savedCuisines },
      "Saved cuisine preferences",
    );
    return { ...inputData, savedCuisines };
  },
});

const saveMealTypesStep = createStep({
  id: "save-meal-types",
  description: "Persist meal type preferences with weight 1",
  inputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
    savedCuisines: z.number().int().nonnegative(),
  }),
  outputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
    savedCuisines: z.number().int().nonnegative(),
    savedMealTypes: z.number().int().nonnegative(),
  }),
  execute: async ({ inputData }) => {
    let savedMealTypes = 0;
    for (const value of inputData.mealTypes) {
      await upsertPreference(inputData.userId, {
        preference_type: "meal_type",
        value,
        weight: 1,
      });
      savedMealTypes += 1;
    }
    logger.info(
      { userId: inputData.userId, savedMealTypes },
      "Saved meal type preferences",
    );
    return { ...inputData, savedMealTypes };
  },
});

const markCompleteStep = createStep({
  id: "mark-onboarding-complete",
  description: "Set onboarding_complete in Supabase user metadata",
  inputSchema: onboardingInputSchema.extend({
    savedDietary: z.number().int().nonnegative(),
    savedAllergies: z.number().int().nonnegative(),
    savedCuisines: z.number().int().nonnegative(),
    savedMealTypes: z.number().int().nonnegative(),
  }),
  outputSchema: onboardingOutputSchema,
  execute: async ({ inputData }) => {
    const { error } = await supabase.auth.admin.updateUserById(inputData.userId, {
      user_metadata: { onboarding_complete: true },
    });
    if (error) {
      logger.error(
        { err: error, userId: inputData.userId },
        "Failed to mark onboarding complete",
      );
      throw error;
    }
    logger.info({ userId: inputData.userId }, "Marked onboarding complete");
    return {
      status: "ok" as const,
      saved: {
        dietaryConstraints: inputData.savedDietary,
        allergies: inputData.savedAllergies,
        cuisines: inputData.savedCuisines,
        mealTypes: inputData.savedMealTypes,
      },
      onboardingComplete: true as const,
    };
  },
});

export const onboardingWorkflow = createWorkflow({
  id: "onboarding-workflow",
  inputSchema: onboardingInputSchema,
  outputSchema: onboardingOutputSchema,
})
  .then(saveDietaryStep)
  .then(saveAllergiesStep)
  .then(saveCuisinesStep)
  .then(saveMealTypesStep)
  .then(markCompleteStep)
  .commit();

/**
 * Run the onboarding workflow directly (avoids circular import through
 * mastra.getWorkflow when tools are registered on the same Mastra instance).
 */
export async function runOnboardingWorkflow(
  input: OnboardingInput,
): Promise<OnboardingOutput> {
  const parsed = onboardingInputSchema.parse(input);
  const run = await onboardingWorkflow.createRun();
  const result = await run.start({ inputData: parsed });

  if (result.status !== "success") {
    const message =
      result.status === "failed"
        ? String(result.error ?? "Onboarding workflow failed")
        : `Onboarding workflow ended with status ${result.status}`;
    throw new Error(message);
  }

  return onboardingOutputSchema.parse(result.result);
}
