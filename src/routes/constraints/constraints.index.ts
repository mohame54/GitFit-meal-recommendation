import { createRouter } from "../../lib/create-router.js";
import {
  deleteConstraintHandler,
  listConstraintsHandler,
  upsertConstraintHandler,
} from "./constraints.handlers.js";
import {
  DeleteConstraintRoute,
  ListConstraintsRoute,
  UpsertConstraintRoute,
} from "./constraints.routes.js";

export const constraintsRouter = createRouter()
  .openapi(ListConstraintsRoute, listConstraintsHandler)
  .openapi(UpsertConstraintRoute, upsertConstraintHandler)
  .openapi(DeleteConstraintRoute, deleteConstraintHandler);
