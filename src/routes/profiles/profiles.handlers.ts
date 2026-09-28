import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  assertOptionalUserIdMatches,
  requireUserId,
} from "../../middlewares/auth.js";
import { createProfile, getProfile, updateProfile } from "../../services/profiles.js";
import {
  CreateProfileRoute,
  GetProfileRoute,
  UpdateProfileRoute,
} from "./profiles.routes.js";

export const createProfileHandler: ApiRouterHandler<typeof CreateProfileRoute> = async (c) => {
  const body = c.req.valid("json");
  const result = await createProfile(body);
  if (!result.profile) {
    c.var.logger.error({ status: result.status }, "Failed to create profile");
    return c.json({ error: "Failed to create profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
  return c.json(result.profile, HttpCodes.CREATED);
};

export const getProfileHandler: ApiRouterHandler<typeof GetProfileRoute> = async (c) => {
  const { userId: paramUserId } = c.req.valid("param");
  try {
    const userId = requireUserId(c.get("userId"));
    assertOptionalUserIdMatches(userId, paramUserId);
    const result = await getProfile(userId);
    if (!result.profile) {
      if (result.status === "profile not found") {
        return c.json({ error: "Profile not found" }, HttpCodes.NOT_FOUND);
      }
      c.var.logger.error({ status: result.status, userId }, "Failed to get profile");
      return c.json({ error: "Failed to get profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
    }
    return c.json(result.profile, HttpCodes.OK);
  } catch (err) {
    if (err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.FORBIDDEN);
    }
    if (err instanceof MissingUserIdError) {
      return c.json({ error: err.message }, HttpCodes.UNAUTHORIZED);
    }
    c.var.logger.error({ err, userId: paramUserId }, "Failed to get profile");
    return c.json({ error: "Failed to get profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateProfileHandler: ApiRouterHandler<typeof UpdateProfileRoute> = async (c) => {
  const { userId: paramUserId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const userId = requireUserId(c.get("userId"));
    assertOptionalUserIdMatches(userId, paramUserId);
    const result = await updateProfile(userId, body);
    if (!result.profile) {
      if (result.status === "email not found") {
        return c.json({ error: "Email not found" }, HttpCodes.BAD_REQUEST);
      }
      c.var.logger.error({ status: result.status, userId }, "Failed to update profile");
      return c.json({ error: "Failed to update profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
    }
    return c.json(result.profile, HttpCodes.OK);
  } catch (err) {
    if (err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.FORBIDDEN);
    }
    if (err instanceof MissingUserIdError) {
      return c.json({ error: err.message }, HttpCodes.UNAUTHORIZED);
    }
    c.var.logger.error({ err, userId: paramUserId }, "Failed to update profile");
    return c.json({ error: "Failed to update profile" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
