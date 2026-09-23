import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  ChatRequestBodySchema,
  ChatSuccessResponseBodySchema,
  chatRequestBodyExample,
} from "./agent.schemas.js";

export const ChatRoute = createRoute({
  method: "post",
  path: "/api/agent/chat",
  tags: ["Agent"],
  request: {
    body: {
      ...jsonContentRequired(ChatRequestBodySchema, "Chat request"),
      content: {
        "application/json": {
          schema: ChatRequestBodySchema,
          example: chatRequestBodyExample,
        },
      },
    },
  },
  responses: {
    [HttpCodes.OK]: jsonContent(ChatSuccessResponseBodySchema, "Agent chat response"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.FORBIDDEN]: jsonContent(ErrorResponseBodySchema, "Forbidden"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
