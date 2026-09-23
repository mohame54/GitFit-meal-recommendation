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
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        preference_type: preference.preference_type,
        value: preference.value,
        weight,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,preference_type,value" },
    )
    .select("preference_type, value, weight")
    .single();
  if (error) {
    logger.error(
      { err: error, userId, preferenceType: preference.preference_type },
      "Failed to upsert preference",
    );
    throw error;
  }
  logger.info(
    { userId, preferenceType: data.preference_type, value: data.value, weight: data.weight },
    "Upserted preference",
  );
  return data;
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
