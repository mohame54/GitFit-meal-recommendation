import { createRoute, z } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  ConstraintIdParamSchema,
  ConstraintSchema,
  ConstraintsQuerySchema,
  UpsertConstraintBodySchema,
} from "./constraints.schemas.js";

export const ListConstraintsRoute = createRoute({
  method: "get",
  path: "/api/constraints",
  tags: ["Constraints"],
  request: { query: ConstraintsQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.array(ConstraintSchema), "User constraints"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const UpsertConstraintRoute = createRoute({
  method: "post",
  path: "/api/constraints",
  tags: ["Constraints"],
  request: {
    body: jsonContentRequired(UpsertConstraintBodySchema, "Constraint"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(ConstraintSchema, "Upserted constraint"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const DeleteConstraintRoute = createRoute({
  method: "delete",
  path: "/api/constraints/{constraintId}",
  tags: ["Constraints"],
  request: {
    params: ConstraintIdParamSchema,
    query: ConstraintsQuerySchema,
  },
  responses: {
    [HttpCodes.OK]: jsonContent(
      z.object({ status: z.literal("ok") }),
      "Deleted",
    ),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
