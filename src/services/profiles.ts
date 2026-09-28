import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import type { Profile, ProfileWithStatus } from "../types/index.js";

const logger = createServiceLogger("profiles");

function profileWithStatus(status: string, profile?: Profile): ProfileWithStatus {
  if (!profile) {
    return { status };
  }
  return { profile, status };
}

export async function createProfile(input: {
  displayName: string;
  email?: string;
}): Promise<ProfileWithStatus> {
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
    const status = "failed to create profile " + JSON.stringify(error);
    return profileWithStatus(status);
  }
  const status = "created profile";
  logger.info({ userId: data.id }, status);

  return profileWithStatus(status, data);
}

export async function getProfile(userId: string): Promise<ProfileWithStatus> {
  logger.debug({ userId }, "Getting profile");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error({ err: error, userId }, "Failed to get profile");
    const status = "failed to get profile " + JSON.stringify(error);
    return profileWithStatus(status);
  }
  if (!data) {
    logger.debug({ userId }, "Profile not found");
    const status = "profile not found";
    return profileWithStatus(status);
  }
  const status = "profile found";
  return profileWithStatus(status, data);
}

export async function updateProfile(
  userId: string,
  input: { displayName?: string; email?: string | null },
): Promise<ProfileWithStatus> {
  logger.info(
    { userId, hasDisplayName: input.displayName !== undefined, hasEmail: input.email !== undefined },
    "Updating profile",
  );
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.email !== undefined) patch.email = input.email;
  // making sure the email and the user is confirmed first
  const existing = await getProfile(userId);
  if (!existing.profile?.email) {
    logger.error({ userId }, "Email not found");
    const status = "email not found";
    return profileWithStatus(status);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, display_name, email, created_at, updated_at")
    .single();
  if (error) {
    logger.error({ err: error, userId }, "Failed to update profile");
    const status = "failed to update profile " + JSON.stringify(error);
    return profileWithStatus(status);
  }
  logger.info({ userId }, "Updated profile");
  const status = "updated profile";
  return profileWithStatus(status, data);
}
