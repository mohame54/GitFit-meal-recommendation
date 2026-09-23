import { createRouter } from "../../lib/create-router.js";
import {
  createProfileHandler,
  getProfileHandler,
  updateProfileHandler,
} from "./profiles.handlers.js";
import {
  CreateProfileRoute,
  GetProfileRoute,
  UpdateProfileRoute,
} from "./profiles.routes.js";

export const profilesRouter = createRouter()
  .openapi(CreateProfileRoute, createProfileHandler)
  .openapi(GetProfileRoute, getProfileHandler)
  .openapi(UpdateProfileRoute, updateProfileHandler);
