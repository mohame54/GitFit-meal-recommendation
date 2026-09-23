import { supabase } from "../db/client.js";
import { createServiceLogger } from "../lib/logger.js";
import type { UserConstraint } from "../types/index.js";

const logger = createServiceLogger("constraints");

export async function listConstraints(userId: string): Promise<UserConstraint[]> {
  logger.debug({ userId }, "Listing constraints");
  const { data, error } = await supabase
    .from("user_constraints")
    .select("id, constraint_type, value")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    logger.error({ err: error, userId }, "Failed to list constraints");
    throw error;
  }
  logger.debug({ userId, count: data?.length ?? 0 }, "Listed constraints");
  return (data ?? []) as UserConstraint[];
}

export async function upsertConstraint(
  userId: string,
  constraint: { constraint_type: UserConstraint["constraint_type"]; value: string },
): Promise<UserConstraint> {
  logger.info(
    { userId, constraintType: constraint.constraint_type, value: constraint.value },
    "Upserting constraint",
  );
  const { data, error } = await supabase
    .from("user_constraints")
    .upsert(
      {
        user_id: userId,
        constraint_type: constraint.constraint_type,
        value: constraint.value,
      },
      { onConflict: "user_id,constraint_type,value" },
    )
    .select("id, constraint_type, value")
    .single();
  if (error) {
    logger.error(
      { err: error, userId, constraintType: constraint.constraint_type },
      "Failed to upsert constraint",
    );
    throw error;
  }
  logger.info({ userId, constraintId: data.id }, "Upserted constraint");
  return data as UserConstraint;
}

export async function deleteConstraint(
  userId: string,
  constraintId: string,
): Promise<void> {
  logger.info({ userId, constraintId }, "Deleting constraint");
  const { error } = await supabase
    .from("user_constraints")
    .delete()
    .eq("id", constraintId)
    .eq("user_id", userId);
  if (error) {
    logger.error({ err: error, userId, constraintId }, "Failed to delete constraint");
    throw error;
  }
  logger.info({ userId, constraintId }, "Deleted constraint");
}
