import { createRouter } from "../lib/create-router.js";
import { HttpCodes } from "../types/https-codes.js";
import type { ApiRouterHandler } from "../lib/create-router.js";
import { HealthRoute, RootRoute } from "./index.routes.js";
import type { HealthResponseBody, RootResponseBody } from "./index.schemas.js";

const router = createRouter();

const rootHandler: ApiRouterHandler<typeof RootRoute> = (c) => {
  c.var.logger.info("Root route requested");
  const responseBody: RootResponseBody = { message: "Meals personalization engine" };
  return c.json(responseBody, HttpCodes.OK);
};

const healthHandler: ApiRouterHandler<typeof HealthRoute> = (c) => {
  c.var.logger.debug("Health check requested");
  const responseBody: HealthResponseBody = { status: "ok" };
  return c.json(responseBody, HttpCodes.OK);
};

router.openapi(RootRoute, rootHandler);
router.openapi(HealthRoute, healthHandler);

export default router;
