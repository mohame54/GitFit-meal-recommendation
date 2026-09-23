import { createRoute, z } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import { ErrorResponseBodySchema, jsonContent } from "../../lib/helpers.js";
import { RecipeResponseBodySchema } from "../recommendations/recommendations.schemas.js";
import {
  ListRecipesQuerySchema,
  RecipeDetailSchema,
  RecipeIdParamSchema,
} from "./recipes.schemas.js";

export const ListRecipesRoute = createRoute({
  method: "get",
  path: "/api/recipes",
  tags: ["Recipes"],
  request: { query: ListRecipesQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.array(RecipeResponseBodySchema), "Recipes"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const GetRecipeRoute = createRoute({
  method: "get",
  path: "/api/recipes/{recipeId}",
  tags: ["Recipes"],
  request: { params: RecipeIdParamSchema },
  responses: {
    [HttpCodes.OK]: jsonContent(RecipeDetailSchema, "Recipe detail"),
    [HttpCodes.NOT_FOUND]: jsonContent(ErrorResponseBodySchema, "Not found"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
