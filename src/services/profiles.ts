import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import type { Profile } from "../types/index.js";

const logger = createServiceLogger("profiles");

export async function createProfile(input: {
  displayName: string;
  email?: string;
}): Promise<Profile> {
  logger.info({ displayName: input.displayName, hasEmail: Boolean(input.email) }, "Creating profile");
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      display_name: input.displayName,
      email: input.email ?? null,
    })
    .select("id, display_name, email, created_at, updated_at")
    .single();
  if (error) {
    logger.error({ err: error }, "Failed to create profile");
    throw error;
  }
  logger.info({ userId: data.id }, "Created profile");
  return data;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  logger.debug({ userId }, "Getting profile");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error({ err: error, userId }, "Failed to get profile");
    throw error;
  }
  if (!data) {
    logger.debug({ userId }, "Profile not found");
    return null;
  }
  return data;
}

export async function updateProfile(
  userId: string,
  input: { displayName?: string; email?: string | null },
): Promise<Profile> {
  logger.info(
    { userId, hasDisplayName: input.displayName !== undefined, hasEmail: input.email !== undefined },
    "Updating profile",
  );
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.email !== undefined) patch.email = input.email;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, display_name, email, created_at, updated_at")
    .single();
  if (error) {
    logger.error({ err: error, userId }, "Failed to update profile");
    throw error;
  }
  logger.info({ userId }, "Updated profile");
  return data;
}
