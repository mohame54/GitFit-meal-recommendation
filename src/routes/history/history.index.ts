import { createRouter } from "../../lib/create-router.js";
import {
  getFeedbackHistoryHandler,
  getRecommendationHistoryHandler,
} from "./history.handlers.js";
import {
  GetFeedbackHistoryRoute,
  GetRecommendationHistoryRoute,
} from "./history.routes.js";

export const historyRouter = createRouter()
  .openapi(GetRecommendationHistoryRoute, getRecommendationHistoryHandler)
  .openapi(GetFeedbackHistoryRoute, getFeedbackHistoryHandler);
