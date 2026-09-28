import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  assertOptionalUserIdMatches,
  requireUserId,
} from "../../middlewares/auth.js";
import {
  getFeedbackHistory,
  getRecommendationHistory,
} from "../../services/history.js";
import {
  GetFeedbackHistoryRoute,
  GetRecommendationHistoryRoute,
} from "./history.routes.js";

export const getRecommendationHistoryHandler: ApiRouterHandler<
  typeof GetRecommendationHistoryRoute
> = async (c) => {
  const query = c.req.valid("query");
  try {
    const userId = requireUserId(c.get("userId"));
    assertOptionalUserIdMatches(userId, query.userId);
    const history = await getRecommendationHistory(userId, query.limit ?? 20);
    return c.json(history, HttpCodes.OK);
  } catch (err) {
    if (err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.FORBIDDEN);
    }
    if (err instanceof MissingUserIdError) {
      return c.json({ error: err.message }, HttpCodes.UNAUTHORIZED);
    }
    c.var.logger.error({ err }, "Failed to get recommendation history");
    return c.json(
      { error: "Failed to get recommendation history" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getFeedbackHistoryHandler: ApiRouterHandler<typeof GetFeedbackHistoryRoute> = async (
  c,
) => {
  const query = c.req.valid("query");
  try {
    const userId = requireUserId(c.get("userId"));
    assertOptionalUserIdMatches(userId, query.userId);
    const history = await getFeedbackHistory(userId, query.limit ?? 20);
    return c.json(history, HttpCodes.OK);
  } catch (err) {
    if (err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.FORBIDDEN);
    }
    if (err instanceof MissingUserIdError) {
      return c.json({ error: err.message }, HttpCodes.UNAUTHORIZED);
    }
    c.var.logger.error({ err }, "Failed to get feedback history");
    return c.json({ error: "Failed to get feedback history" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
