import { supabase } from "../db/client.js";
import { extractFeedbackSignal } from "../lib/llm.js";
import { createServiceLogger } from "../lib/logger.js";
import {
  ALLOWED_PREFERENCE_TYPES,
  validateExtraction,
} from "../lib/feedback-validation.js";
import {
  clampWeight,
  polarityFromRating,
  weightDeltaFromPolarity,
} from "../lib/scoring.js";
import type {
  ExtractedFeedback,
  FeedbackInput,
  RecipeAttribute,
} from "../types/index.js";

export { ALLOWED_PREFERENCE_TYPES, validateExtraction };

const logger = createServiceLogger("feedback");

async function upsertPreferenceWeight(
  userId: string,
  preferenceType: string,
  value: string,
  delta: number,
) {
  const { data: existing, error: fetchError } = await supabase
    .from("user_preferences")
    .select("weight")
    .eq("user_id", userId)
    .eq("preference_type", preferenceType)
    .eq("value", value)
    .maybeSingle();
  if (fetchError) {
    logger.error(
      { err: fetchError, userId, preferenceType, value },
      "Failed to fetch preference weight",
    );
    throw fetchError;
  }

  const currentWeight = existing?.weight ?? 0;
  const newWeight = clampWeight(currentWeight + delta);

  const { error: upsertError } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      preference_type: preferenceType,
      value,
      weight: newWeight,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,preference_type,value" },
  );
  if (upsertError) {
    logger.error(
      { err: upsertError, userId, preferenceType, value },
      "Failed to upsert preference weight",
    );
    throw upsertError;
  }
  logger.debug(
    { userId, preferenceType, value, previousWeight: currentWeight, newWeight, delta },
    "Updated preference weight",
  );
}

async function insertFeedbackAnalysis(params: {
  feedbackId: string;
  sentiment: string | null;
  extracted: unknown;
  isValid: boolean;
  errorMessage?: string | null;
  appliedAt?: string | null;
}) {
  const { error } = await supabase.from("feedback_analysis").insert({
    feedback_id: params.feedbackId,
    sentiment: params.sentiment,
    extracted: params.extracted,
    is_valid: params.isValid,
    error_message: params.errorMessage ?? null,
    applied_at: params.appliedAt ?? null,
  });
  if (error) {
    logger.error({ err: error, feedbackId: params.feedbackId }, "Failed to insert feedback analysis");
    throw error;
  }
}

async function getRecipeAttributes(recipeId: string): Promise<RecipeAttribute[]> {
  const { data, error } = await supabase
    .from("recipe_attributes")
    .select("attribute_type, attribute_value")
    .eq("recipe_id", recipeId);
  if (error) {
    logger.error({ err: error, recipeId }, "Failed to get recipe attributes for feedback");
    throw error;
  }
  return data ?? [];
}

/**
 * When there is no free-text comment, still nudge weights from rating/liked
 * using the recipe's own attributes (deterministic, no LLM).
 */
async function applyExplicitSignal(
  userId: string,
  recipeId: string,
  polarity: -1 | 0 | 1,
): Promise<void> {
  if (polarity === 0) return;
  const attributes = await getRecipeAttributes(recipeId);
  const delta = weightDeltaFromPolarity(polarity);
  logger.debug(
    { userId, recipeId, polarity, attributeCount: attributes.length },
    "Applying explicit feedback signal",
  );
  for (const attr of attributes) {
    if (!ALLOWED_PREFERENCE_TYPES.has(attr.attribute_type)) continue;
    await upsertPreferenceWeight(userId, attr.attribute_type, attr.attribute_value, delta);
  }
}

/**
 * Full pipeline: insert feedback -> AI extraction (if comment) -> validation -> upsert.
 * Fail-closed: feedback is always saved; preference weights only change on valid signals.
 */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const { userId, recipeId, rating, liked, comment } = input;
  logger.info(
    { userId, recipeId, rating, liked, hasComment: Boolean(comment) },
    "Submitting feedback",
  );

  const { data: feedbackRow, error: feedbackError } = await supabase
    .from("feedback")
    .insert({ user_id: userId, recipe_id: recipeId, rating, liked, comment })
    .select("id")
    .single();
  if (feedbackError) {
    logger.error({ err: feedbackError, userId, recipeId }, "Failed to insert feedback");
    throw feedbackError;
  }

  // Path A: free-text comment → LLM extraction
  if (comment) {
    let extracted: unknown;
    try {
      extracted = await extractFeedbackSignal(comment);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, userId, recipeId, feedbackId: feedbackRow.id }, "LLM extraction failed");
      await insertFeedbackAnalysis({
        feedbackId: feedbackRow.id,
        sentiment: null,
        extracted: { error: message },
        isValid: false,
        errorMessage: message,
      });
      return;
    }

    const isValid = validateExtraction(extracted);
    await insertFeedbackAnalysis({
      feedbackId: feedbackRow.id,
      sentiment: isValid ? (extracted as ExtractedFeedback).sentiment : null,
      extracted,
      isValid,
      errorMessage: isValid ? null : "Extraction failed schema validation",
    });

    if (!isValid) {
      logger.warn(
        { userId, recipeId, feedbackId: feedbackRow.id },
        "Feedback extraction failed validation, skipping preference update",
      );
      return;
    }

    const { attributes } = extracted as ExtractedFeedback;
    logger.info(
      { userId, recipeId, feedbackId: feedbackRow.id, attributeCount: attributes.length },
      "Applying extracted feedback signals",
    );
    for (const attr of attributes) {
      await upsertPreferenceWeight(
        userId,
        attr.preference_type,
        attr.value,
        weightDeltaFromPolarity(attr.polarity),
      );
    }

    const { error: appliedError } = await supabase
      .from("feedback_analysis")
      .update({ applied_at: new Date().toISOString() })
      .eq("feedback_id", feedbackRow.id);
    if (appliedError) {
      logger.error(
        { err: appliedError, userId, feedbackId: feedbackRow.id },
        "Failed to mark feedback analysis as applied",
      );
      throw appliedError;
    }
    logger.info({ userId, recipeId, feedbackId: feedbackRow.id }, "Applied comment feedback");
    return;
  }

  // Path B: rating / liked without comment → deterministic attribute nudge
  let polarity: -1 | 0 | 1 = 0;
  if (typeof liked === "boolean") {
    polarity = liked ? 1 : -1;
  } else if (typeof rating === "number") {
    polarity = polarityFromRating(rating);
  }

  if (polarity !== 0) {
    await applyExplicitSignal(userId, recipeId, polarity);
    await insertFeedbackAnalysis({
      feedbackId: feedbackRow.id,
      sentiment: polarity > 0 ? "positive" : "negative",
      extracted: { source: "explicit", rating: rating ?? null, liked: liked ?? null },
      isValid: true,
      appliedAt: new Date().toISOString(),
    });
    logger.info(
      { userId, recipeId, feedbackId: feedbackRow.id, polarity },
      "Applied explicit feedback",
    );
    return;
  }

  logger.debug(
    { userId, recipeId, feedbackId: feedbackRow.id },
    "Feedback stored without preference update",
  );
}
