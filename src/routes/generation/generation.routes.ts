import { createRoute, z } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  GenerateRecipeBodySchema,
  GeneratedRecipeSchema,
  ListGeneratedQuerySchema,
} from "./generation.schemas.js";

export const GenerateRecipeRoute = createRoute({
  method: "post",
  path: "/api/generate",
  tags: ["Generation"],
  request: {
    body: jsonContentRequired(GenerateRecipeBodySchema, "Generation request"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(GeneratedRecipeSchema, "Generated recipe"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const ListGeneratedRecipesRoute = createRoute({
  method: "get",
  path: "/api/generate",
  tags: ["Generation"],
  request: { query: ListGeneratedQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.array(GeneratedRecipeSchema), "Generated recipes"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
