import { createRouter } from "../../lib/create-router.js";
import {
  deletePreferenceHandler,
  listPreferencesHandler,
  upsertPreferenceHandler,
} from "./preferences.handlers.js";
import {
  DeletePreferenceRoute,
  ListPreferencesRoute,
  UpsertPreferenceRoute,
} from "./preferences.routes.js";

export const preferencesRouter = createRouter()
  .openapi(ListPreferencesRoute, listPreferencesHandler)
  .openapi(UpsertPreferenceRoute, upsertPreferenceHandler)
  .openapi(DeletePreferenceRoute, deletePreferenceHandler);
