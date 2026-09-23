import { createRouter } from "../../lib/create-router.js";
import { chatHandler } from "./agent.handlers.js";
import { ChatRoute } from "./agent.routes.js";

export const agentRouter = createRouter().openapi(ChatRoute, chatHandler);
