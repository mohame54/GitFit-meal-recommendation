import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import {
  deleteConstraint,
  listConstraints,
  upsertConstraint,
} from "../../services/constraints.js";
import {
  DeleteConstraintRoute,
  ListConstraintsRoute,
  UpsertConstraintRoute,
} from "./constraints.routes.js";

export const listConstraintsHandler: ApiRouterHandler<typeof ListConstraintsRoute> = async (
  c,
) => {
  const query = c.req.valid("query");
  try {
    const userId = resolveUserId(c.get("userId"), query.userId);
    const constraints = await listConstraints(userId);
    return c.json(constraints, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to list constraints");
    return c.json({ error: "Failed to list constraints" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const upsertConstraintHandler: ApiRouterHandler<typeof UpsertConstraintRoute> = async (
  c,
) => {
  const body = c.req.valid("json");
  try {
    const userId = resolveUserId(c.get("userId"), body.userId);
    const constraint = await upsertConstraint(userId, {
      constraint_type: body.constraint_type,
      value: body.value,
    });
    return c.json(constraint, HttpCodes.CREATED);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to upsert constraint");
    return c.json({ error: "Failed to upsert constraint" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deleteConstraintHandler: ApiRouterHandler<typeof DeleteConstraintRoute> = async (
  c,
) => {
  const { constraintId } = c.req.valid("param");
  const query = c.req.valid("query");
  try {
    const userId = resolveUserId(c.get("userId"), query.userId);
    await deleteConstraint(userId, constraintId);
    return c.json({ status: "ok" as const }, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to delete constraint");
    return c.json({ error: "Failed to delete constraint" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
