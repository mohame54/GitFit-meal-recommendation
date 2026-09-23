import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ingestRandomSpoonacularRecipes,
  ingestSpoonacularByIds,
  ingestSpoonacularSearch,
} from "../../services/ingestion.js";
import {
  IngestByIdsRoute,
  IngestRandomRoute,
  IngestSearchRoute,
} from "./ingestion.routes.js";

export const ingestByIdsHandler: ApiRouterHandler<typeof IngestByIdsRoute> = async (c) => {
  const body = c.req.valid("json");
  try {
    const result = await ingestSpoonacularByIds(body.ids);
    return c.json(result, HttpCodes.CREATED);
  } catch (err) {
    c.var.logger.error({ err }, "Failed to ingest Spoonacular recipes by id");
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to ingest recipes" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const ingestRandomHandler: ApiRouterHandler<typeof IngestRandomRoute> = async (c) => {
  const body = c.req.valid("json");
  try {
    const result = await ingestRandomSpoonacularRecipes(body.number ?? 10, body.tags);
    return c.json(result, HttpCodes.CREATED);
  } catch (err) {
    c.var.logger.error({ err }, "Failed to ingest random Spoonacular recipes");
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to ingest recipes" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const ingestSearchHandler: ApiRouterHandler<typeof IngestSearchRoute> = async (c) => {
  const body = c.req.valid("json");
  try {
    const result = await ingestSpoonacularSearch(body);
    return c.json(result, HttpCodes.CREATED);
  } catch (err) {
    c.var.logger.error({ err }, "Failed to ingest Spoonacular search results");
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to ingest recipes" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
