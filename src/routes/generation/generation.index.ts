import { createRouter } from "../../lib/create-router.js";
import {
  generateRecipeHandler,
  listGeneratedRecipesHandler,
} from "./generation.handlers.js";
import {
  GenerateRecipeRoute,
  ListGeneratedRecipesRoute,
} from "./generation.routes.js";

export const generationRouter = createRouter()
  .openapi(GenerateRecipeRoute, generateRecipeHandler)
  .openapi(ListGeneratedRecipesRoute, listGeneratedRecipesHandler);
