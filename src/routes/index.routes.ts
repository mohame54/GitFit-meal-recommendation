import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../types/https-codes.js";
import {
  HealthResponseBodySchema,
  RootResponseBodySchema,
  healthResponseBodyExample,
  rootResponseBodyExample,
} from "./index.schemas.js";

export const RootRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["General"],
  responses: {
    [HttpCodes.OK]: {
      description: "API root message",
      content: {
        "application/json": {
          schema: RootResponseBodySchema,
          example: rootResponseBodyExample,
        },
      },
    },
  },
});

export const HealthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["General"],
  responses: {
    [HttpCodes.OK]: {
      description: "Health check",
      content: {
        "application/json": {
          schema: HealthResponseBodySchema,
          example: healthResponseBodyExample,
        },
      },
    },
  },
});
