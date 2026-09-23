import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import {
  deletePreference,
  listPreferences,
  upsertPreference,
} from "../../services/preferences.js";
import {
  DeletePreferenceRoute,
  ListPreferencesRoute,
  UpsertPreferenceRoute,
} from "./preferences.routes.js";

export const listPreferencesHandler: ApiRouterHandler<typeof ListPreferencesRoute> = async (
  c,
) => {
  const query = c.req.valid("query");
  try {
    const userId = resolveUserId(c.get("userId"), query.userId);
    const preferences = await listPreferences(userId);
    return c.json(preferences, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to list preferences");
    return c.json({ error: "Failed to list preferences" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const upsertPreferenceHandler: ApiRouterHandler<typeof UpsertPreferenceRoute> = async (
  c,
) => {
  const body = c.req.valid("json");
  try {
    const userId = resolveUserId(c.get("userId"), body.userId);
    const preference = await upsertPreference(userId, {
      preference_type: body.preference_type,
      value: body.value,
      weight: body.weight,
    });
    return c.json(preference, HttpCodes.CREATED);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to upsert preference");
    return c.json({ error: "Failed to upsert preference" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deletePreferenceHandler: ApiRouterHandler<typeof DeletePreferenceRoute> = async (
  c,
) => {
  const query = c.req.valid("query");
  try {
    const userId = resolveUserId(c.get("userId"), query.userId);
    await deletePreference(userId, query.preference_type, query.value);
    return c.json({ status: "ok" as const }, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to delete preference");
    return c.json({ error: "Failed to delete preference" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
