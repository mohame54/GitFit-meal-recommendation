import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { conversationStateService } from "../../services/conversation.js";
import {
  cuisinePreferenceSchema,
  dietaryConstraintSchema,
  mealTypePreferenceSchema,
  normalizeAllergies,
} from "../workflows/onboarding-constants.js";
import { runOnboardingWorkflow } from "../workflows/onboarding-workflow.js";

export const submitOnboardingTool = createTool({
  id: "submit-onboarding",
  description:
    "Persist onboarding answers (dietary constraints, allergies, cuisines, meal types) " +
    "and mark onboarding_complete in user metadata. Empty arrays mean the step was skipped. " +
    "Call only after the user confirms Finish.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The meals profile UUID (trusted userId from context)"),
    dietaryConstraints: z
      .array(dietaryConstraintSchema)
      .default([])
      .describe("Selected diets, or [] if skipped"),
    allergies: z
      .array(z.string())
      .default([])
      .describe("Allergy tags, or [] if skipped"),
    cuisines: z
      .array(cuisinePreferenceSchema)
      .default([])
      .describe("Selected cuisines, or [] if skipped"),
    mealTypes: z
      .array(mealTypePreferenceSchema)
      .default([])
      .describe("Selected meal types, or [] if skipped"),
  }),
  outputSchema: z.object({
    status: z.literal("ok"),
    saved: z.object({
      dietaryConstraints: z.number(),
      allergies: z.number(),
      cuisines: z.number(),
      mealTypes: z.number(),
    }),
    onboardingComplete: z.literal(true),
  }),
  execute: async (input, context) => {
    const sessionIdRaw = context?.requestContext?.getRaw("sessionId");
    const sessionId =
      typeof sessionIdRaw === "string" && sessionIdRaw.trim()
        ? sessionIdRaw.trim()
        : null;
    const session = sessionId
      ? conversationStateService.getSession(sessionId)
      : undefined;
    const authUserId = session?.authUserId?.trim();
    if (!authUserId) {
      throw new Error(
        "Missing authUserId on conversation session; cannot mark onboarding complete",
      );
    }

    return runOnboardingWorkflow({
      userId: input.userId,
      authUserId,
      dietaryConstraints: input.dietaryConstraints ?? [],
      allergies: normalizeAllergies(input.allergies ?? []),
      cuisines: input.cuisines ?? [],
      mealTypes: input.mealTypes ?? [],
    });
  },
});
