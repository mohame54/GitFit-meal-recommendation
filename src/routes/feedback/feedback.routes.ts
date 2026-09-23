import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  SubmitFeedbackRequestBodySchema,
  SubmitFeedbackSuccessResponseBodySchema,
  submitFeedbackRequestBodyExample,
  submitFeedbackSuccessResponseBodyExample,
} from "./feedback.schemas.js";

export const SubmitFeedbackRoute = createRoute({
  method: "post",
  path: "/api/feedback",
  tags: ["Feedback"],
  request: {
    body: {
      ...jsonContentRequired(SubmitFeedbackRequestBodySchema, "Feedback payload"),
      content: {
        "application/json": {
          schema: SubmitFeedbackRequestBodySchema,
          example: submitFeedbackRequestBodyExample,
        },
      },
    },
  },
  responses: {
    [HttpCodes.CREATED]: {
      ...jsonContent(SubmitFeedbackSuccessResponseBodySchema, "Feedback submitted"),
      content: {
        "application/json": {
          schema: SubmitFeedbackSuccessResponseBodySchema,
          example: submitFeedbackSuccessResponseBodyExample,
        },
      },
    },
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
