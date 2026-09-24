import { createRequire } from "node:module";
import { pino, type DestinationStream, type Logger } from "pino";
import { parseEnv } from "../env-parser.js";
import { LogLevel, NodeEnv } from "../types/enums.js";

const require = createRequire(import.meta.url);

let instance: Logger | null = null;

/** Loaded only outside production. The runtime image omits this devDependency. */
function devPrettyStream(): DestinationStream {
  const pretty = require("pino-pretty") as (opts?: object) => DestinationStream;
  return pretty();
}

/** Shared pino instance used by HTTP middleware and services. */
export function getLogger(): Logger {
  if (instance) return instance;

  const env = parseEnv();
  const level =
    env.LOG_LEVEL ?? (env.NODE_ENV === NodeEnv.PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG);

  instance =
    env.NODE_ENV === NodeEnv.PRODUCTION
      ? pino({ level })
      : pino({ level }, devPrettyStream());

  return instance;
}

export function createServiceLogger(service: string): Logger {
  return getLogger().child({ service });
}
