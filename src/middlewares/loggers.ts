import { randomUUID } from "node:crypto";
import { logger as honoLogger } from "hono/logger";
import { pinoLogger } from "hono-pino";
import { getLogger } from "../lib/logger.js";

export function createPinoLogger() {
  return pinoLogger({
    pino: getLogger(),
    http: {
      reqId: () => randomUUID(),
    },
  });
}

export function createHonoLogger() {
  return honoLogger();
}

export function createLogger() {
  return createPinoLogger();
}
