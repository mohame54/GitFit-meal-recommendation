import { createRouter } from "../../lib/create-router.js";
import { getRecipeHandler, listRecipesHandler } from "./recipes.handlers.js";
import { GetRecipeRoute, ListRecipesRoute } from "./recipes.routes.js";
import {
  ingestByIdsHandler,
  ingestRandomHandler,
  ingestSearchHandler,
} from "./ingestion.handlers.js";
import {
  IngestByIdsRoute,
  IngestRandomRoute,
  IngestSearchRoute,
} from "./ingestion.routes.js";

export const recipesRouter = createRouter()
  .openapi(ListRecipesRoute, listRecipesHandler)
  // Register ingest paths before /{recipeId} so they aren't captured as ids
  .openapi(IngestByIdsRoute, ingestByIdsHandler)
  .openapi(IngestRandomRoute, ingestRandomHandler)
  .openapi(IngestSearchRoute, ingestSearchHandler)
  .openapi(GetRecipeRoute, getRecipeHandler);
