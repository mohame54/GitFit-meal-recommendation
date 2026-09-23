import type { NotFoundHandler } from "hono";
import { HttpCodes, HttpMessages } from "../types/https-codes.js";
import type { AppEnv } from "../lib/create-router.js";

const notFound: NotFoundHandler<AppEnv> = (c) => {
  c.var.logger.warn({ path: c.req.path }, "Route not found");
  return c.json({
    message: `${HttpMessages.NOT_FOUND} - ${c.req.path}`,
  }, HttpCodes.NOT_FOUND);
};

export default notFound;
