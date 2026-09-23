import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import { createProfile, getProfile, updateProfile } from "../../services/profiles.js";
import {
  CreateProfileRoute,
  GetProfileRoute,
  UpdateProfileRoute,
} from "./profiles.routes.js";

export const createProfileHandler: ApiRouterHandler<typeof CreateProfileRoute> = async (c) => {
  const body = c.req.valid("json");
  try {
    const profile = await createProfile(body);
    return c.json(profile, HttpCodes.CREATED);
  } catch (err) {
    c.var.logger.error({ err }, "Failed to create profile");
    return c.json({ error: "Failed to create profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const getProfileHandler: ApiRouterHandler<typeof GetProfileRoute> = async (c) => {
  const { userId: paramUserId } = c.req.valid("param");
  try {
    const userId = resolveUserId(c.get("userId"), paramUserId);
    const profile = await getProfile(userId);
    if (!profile) {
      return c.json({ error: "Profile not found" }, HttpCodes.NOT_FOUND);
    }
    return c.json(profile, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err, userId: paramUserId }, "Failed to get profile");
    return c.json({ error: "Failed to get profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateProfileHandler: ApiRouterHandler<typeof UpdateProfileRoute> = async (c) => {
  const { userId: paramUserId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const userId = resolveUserId(c.get("userId"), paramUserId);
    const profile = await updateProfile(userId, body);
    return c.json(profile, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err, userId: paramUserId }, "Failed to update profile");
    return c.json({ error: "Failed to update profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
