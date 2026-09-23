import { createRouter } from "../../lib/create-router.js";
import { submitFeedbackHandler } from "./feedback.handlers.js";
import { SubmitFeedbackRoute } from "./feedback.routes.js";

export const feedbackRouter = createRouter().openapi(SubmitFeedbackRoute, submitFeedbackHandler);
