import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  IngestByIdsBodySchema,
  IngestRandomBodySchema,
  IngestResultSchema,
  IngestSearchBodySchema,
} from "./ingestion.schemas.js";

export const IngestByIdsRoute = createRoute({
  method: "post",
  path: "/api/recipes/ingest/ids",
  tags: ["Recipes"],
  summary: "Cache Spoonacular recipes by id (informationBulk → Postgres)",
  request: {
    body: jsonContentRequired(IngestByIdsBodySchema, "Spoonacular recipe ids"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(IngestResultSchema, "Ingested recipes"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const IngestRandomRoute = createRoute({
  method: "post",
  path: "/api/recipes/ingest/random",
  tags: ["Recipes"],
  summary: "Pull random Spoonacular recipes and cache them locally",
  request: {
    body: jsonContentRequired(IngestRandomBodySchema, "Random ingest options"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(IngestResultSchema, "Ingested recipes"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const IngestSearchRoute = createRoute({
  method: "post",
  path: "/api/recipes/ingest/search",
  tags: ["Recipes"],
  summary: "Search Spoonacular then cache full recipe information locally",
  request: {
    body: jsonContentRequired(IngestSearchBodySchema, "Search ingest options"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(IngestResultSchema, "Ingested recipes"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
