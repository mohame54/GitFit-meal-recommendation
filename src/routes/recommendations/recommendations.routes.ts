import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import { ErrorResponseBodySchema, jsonContent } from "../../lib/helpers.js";
import {
  GetRecommendationsQuerySchema,
  GetRecommendationsSuccessResponseBodySchema,
} from "./recommendations.schemas.js";

export const GetRecommendationsRoute = createRoute({
  method: "get",
  path: "/api/recommendations",
  tags: ["Recommendations"],
  request: {
    query: GetRecommendationsQuerySchema,
  },
  responses: {
    [HttpCodes.OK]: jsonContent(
      GetRecommendationsSuccessResponseBodySchema,
      "Ranked recipe recommendations",
    ),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
