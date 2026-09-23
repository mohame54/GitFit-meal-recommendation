import { createRoute, z } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  DeletePreferenceQuerySchema,
  PreferenceSchema,
  PreferencesQuerySchema,
  UpsertPreferenceBodySchema,
} from "./preferences.schemas.js";

export const ListPreferencesRoute = createRoute({
  method: "get",
  path: "/api/preferences",
  tags: ["Preferences"],
  request: { query: PreferencesQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.array(PreferenceSchema), "User preferences"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const UpsertPreferenceRoute = createRoute({
  method: "post",
  path: "/api/preferences",
  tags: ["Preferences"],
  request: {
    body: jsonContentRequired(UpsertPreferenceBodySchema, "Preference"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(PreferenceSchema, "Upserted preference"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const DeletePreferenceRoute = createRoute({
  method: "delete",
  path: "/api/preferences",
  tags: ["Preferences"],
  request: { query: DeletePreferenceQuerySchema },
  responses: {
    [HttpCodes.OK]: jsonContent(z.object({ status: z.literal("ok") }), "Deleted"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
