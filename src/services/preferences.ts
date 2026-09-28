import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import { clampWeight } from "../lib/scoring.js";
import type { UserPreference } from "../types/index.js";

const logger = createServiceLogger("preferences");

export async function listPreferences(userId: string): Promise<UserPreference[]> {
  logger.debug({ userId }, "Listing preferences");
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preference_type, value, weight")
    .eq("user_id", userId)
    .order("weight", { ascending: false });
  if (error) {
    logger.error({ err: error, userId }, "Failed to list preferences");
    throw error;
  }
  logger.debug({ userId, count: data?.length ?? 0 }, "Listed preferences");
  return data ?? [];
}

export async function upsertPreference(
  userId: string,
  preference: { preference_type: string; value: string; weight: number },
): Promise<UserPreference> {
  const weight = clampWeight(preference.weight);
  logger.info(
    {
      userId,
      preferenceType: preference.preference_type,
      value: preference.value,
      weight,
    },
    "Upserting preference",
  );
  const match = supabase
    .from("user_preferences")
    .select("preference_type, value, weight")
    .eq("user_id", userId)
    .eq("preference_type", preference.preference_type)
    .eq("value", preference.value)
    .limit(1);
  const { data: existingRows, error: fetchError } = await match;
  if (fetchError) {
    logger.error(
      { err: fetchError, userId, preferenceType: preference.preference_type },
      "Failed to fetch preference",
    );
    throw fetchError;
  }

  const row = {
    user_id: userId,
    preference_type: preference.preference_type,
    value: preference.value,
    weight,
    updated_at: new Date().toISOString(),
  };
  const write = existingRows?.[0]
    ? supabase
        .from("user_preferences")
        .update({ weight: row.weight, updated_at: row.updated_at })
        .eq("user_id", userId)
        .eq("preference_type", preference.preference_type)
        .eq("value", preference.value)
    : supabase.from("user_preferences").insert(row);
  const { data, error } = await write.select("preference_type, value, weight").limit(1);
  if (error) {
    logger.error(
      { err: error, userId, preferenceType: preference.preference_type },
      "Failed to save preference",
    );
    throw error;
  }
  const saved = data?.[0];
  if (!saved) {
    const missing = new Error("Preference save returned no row");
    logger.error(
      { err: missing, userId, preferenceType: preference.preference_type },
      "Failed to save preference",
    );
    throw missing;
  }
  logger.info(
    { userId, preferenceType: saved.preference_type, value: saved.value, weight: saved.weight },
    "Saved preference",
  );
  return saved;
}

export async function deletePreference(
  userId: string,
  preferenceType: string,
  value: string,
): Promise<void> {
  logger.info({ userId, preferenceType, value }, "Deleting preference");
  const { error } = await supabase
    .from("user_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("preference_type", preferenceType)
    .eq("value", value);
  if (error) {
    logger.error({ err: error, userId, preferenceType, value }, "Failed to delete preference");
    throw error;
  }
  logger.info({ userId, preferenceType, value }, "Deleted preference");
}
