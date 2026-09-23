import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import { getRecommendations } from "../../services/recommendations.js";
import { GetRecommendationsRoute } from "./recommendations.routes.js";
import type { GetRecommendationsSuccessResponseBody } from "./recommendations.schemas.js";

export const getRecommendationsHandler: ApiRouterHandler<
  typeof GetRecommendationsRoute
> = async (c) => {
  const { userId: queryUserId, limit } = c.req.valid("query");

  try {
    const userId = resolveUserId(c.get("userId"), queryUserId);
    c.var.logger.info({ userId, limit }, "Getting recommendations");
    const results = await getRecommendations(userId, limit);
    const responseBody: GetRecommendationsSuccessResponseBody = results;
    return c.json(responseBody, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to get recommendations");
    return c.json({ error: "Failed to get recommendations" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
