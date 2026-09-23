import { createRoute } from "@hono/zod-openapi";
import { HttpCodes } from "../../types/https-codes.js";
import {
  ErrorResponseBodySchema,
  jsonContent,
  jsonContentRequired,
} from "../../lib/helpers.js";
import {
  CreateProfileBodySchema,
  ProfileSchema,
  UpdateProfileBodySchema,
  UserIdParamSchema,
} from "./profiles.schemas.js";

export const CreateProfileRoute = createRoute({
  method: "post",
  path: "/api/profiles",
  tags: ["Profiles"],
  request: {
    body: jsonContentRequired(CreateProfileBodySchema, "Create profile"),
  },
  responses: {
    [HttpCodes.CREATED]: jsonContent(ProfileSchema, "Created profile"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const GetProfileRoute = createRoute({
  method: "get",
  path: "/api/profiles/{userId}",
  tags: ["Profiles"],
  request: { params: UserIdParamSchema },
  responses: {
    [HttpCodes.OK]: jsonContent(ProfileSchema, "Profile"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.NOT_FOUND]: jsonContent(ErrorResponseBodySchema, "Not found"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});

export const UpdateProfileRoute = createRoute({
  method: "patch",
  path: "/api/profiles/{userId}",
  tags: ["Profiles"],
  request: {
    params: UserIdParamSchema,
    body: jsonContentRequired(UpdateProfileBodySchema, "Update profile"),
  },
  responses: {
    [HttpCodes.OK]: jsonContent(ProfileSchema, "Updated profile"),
    [HttpCodes.BAD_REQUEST]: jsonContent(ErrorResponseBodySchema, "Bad request"),
    [HttpCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      ErrorResponseBodySchema,
      "Internal server error",
    ),
  },
});
