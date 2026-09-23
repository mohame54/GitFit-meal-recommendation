import { pino, type Logger } from "pino";
import pretty from "pino-pretty";
import { parseEnv } from "../env-parser.js";
import { LogLevel, NodeEnv } from "../types/enums.js";

let instance: Logger | null = null;

/** Shared pino instance used by HTTP middleware and services. */
export function getLogger(): Logger {
  if (instance) return instance;

  const env = parseEnv();
  const level =
    env.LOG_LEVEL ?? (env.NODE_ENV === NodeEnv.PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG);

  instance =
    env.NODE_ENV === NodeEnv.PRODUCTION ? pino({ level }) : pino({ level }, pretty());

  return instance;
}

export function createServiceLogger(service: string): Logger {
  return getLogger().child({ service });
}
