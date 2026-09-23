import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import { submitFeedback } from "../../services/feedback.js";
import { SubmitFeedbackRoute } from "./feedback.routes.js";
import type { SubmitFeedbackSuccessResponseBody } from "./feedback.schemas.js";

export const submitFeedbackHandler: ApiRouterHandler<typeof SubmitFeedbackRoute> = async (c) => {
  const body = c.req.valid("json");

  try {
    const userId = resolveUserId(c.get("userId"), body.userId);
    c.var.logger.info(
      { userId, recipeId: body.recipeId, rating: body.rating, liked: body.liked },
      "Submitting feedback",
    );
    await submitFeedback({
      userId,
      recipeId: body.recipeId,
      rating: body.rating,
      liked: body.liked,
      comment: body.comment,
    });
    const responseBody: SubmitFeedbackSuccessResponseBody = { status: "ok" };
    return c.json(responseBody, HttpCodes.CREATED);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to submit feedback");
    return c.json({ error: "Failed to submit feedback" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
