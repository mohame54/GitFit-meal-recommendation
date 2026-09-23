import { createRouter } from "../../lib/create-router.js";
import { getRecommendationsHandler } from "./recommendations.handlers.js";
import { GetRecommendationsRoute } from "./recommendations.routes.js";

export const recommendationsRouter = createRouter().openapi(
  GetRecommendationsRoute,
  getRecommendationsHandler,
);
