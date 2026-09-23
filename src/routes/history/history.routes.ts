import { createRoute, z } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import { ErrorResponseBodySchema, jsonContent } from "../../lib/helpers.js";
import {
  FeedbackHistoryItemSchema,
  HistoryQuerySchema,
  RecommendationHistoryItemSchema,
} from "./history.schemas.js";

export const GetRecommendationHistoryRoute = createRoute({
  method: "get",
  path: "/api/history/recommendations",
  tags: ["History"],
  request: { query: HistoryQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(
      z.array(RecommendationHistoryItemSchema),
      "Recommendation history",
    ),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const GetFeedbackHistoryRoute = createRoute({
  method: "get",
  path: "/api/history/feedback",
  tags: ["History"],
  request: { query: HistoryQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.array(FeedbackHistoryItemSchema), "Feedback history"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
