import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pino, stdSerializers, type DestinationStream, type Logger } from "pino";
import { parseEnv } from "../env-parser.js";
import { LogLevel, NodeEnv } from "../types/enums.js";

const require = createRequire(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ERROR_LEVEL = 50;

const LOGGER_INTERNAL_FRAME =
  /[/\\](?:node_modules[/\\](?:pino|pino-pretty|pino-std-serializers|hono-pino)[/\\]|src[/\\]lib[/\\]logger\.[cm]?[jt]s)|node:internal|node:events/;

let instance: Logger | null = null;

export type CreatePinoLoggerOptions = {
  level: string;
  pretty: boolean;
  destination?: DestinationStream;
};

function toProjectPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const root = PROJECT_ROOT.replaceAll("\\", "/");
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  return normalized;
}

function parseCaller(frame: string): string | undefined {
  const match = /\(?((?:file:\/\/)?[^\s)]+):(\d+):(\d+)\)?\s*$/.exec(frame);
  if (!match) return undefined;

  let filePath = match[1];
  if (filePath.startsWith("file://")) {
    filePath = fileURLToPath(filePath);
  }
  return `${toProjectPath(filePath)}:${match[2]}:${match[3]}`;
}

function isLoggerInternalFrame(frame: string): boolean {
  return LOGGER_INTERNAL_FRAME.test(frame);
}

function isProjectCaller(caller: string): boolean {
  return !caller.includes("node_modules/") && !caller.startsWith("node:");
}

function sourceLineFromStack(stack: string): string | undefined {
  const frames = stack.split("\n").slice(1).filter((frame) => !isLoggerInternalFrame(frame));
  for (const frame of frames) {
    const caller = parseCaller(frame);
    if (caller && isProjectCaller(caller)) return caller;
  }
  return frames[0] ? parseCaller(frames[0]) : undefined;
}

function captureLogSite(): { caller?: string; traceback: string } {
  const stack = new Error().stack ?? "";
  const frames = stack.split("\n").slice(1).filter((frame) => !isLoggerInternalFrame(frame));
  return {
    caller: sourceLineFromStack(["Error", ...frames].join("\n")),
    traceback: ["Error: logged here", ...frames].join("\n"),
  };
}

function hasStack(value: unknown): value is { stack: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { stack?: unknown }).stack === "string" &&
      (value as { stack: string }).stack.length > 0,
  );
}

function attachStack(err: unknown, traceback: string): unknown {
  if (err instanceof Error) {
    if (!err.stack) err.stack = traceback;
    return err;
  }
  if (err && typeof err === "object") {
    return { ...(err as Record<string, unknown>), stack: traceback };
  }
  return { message: String(err), stack: traceback };
}

function serializeLogError(err: unknown): unknown {
  if (err instanceof Error) return stdSerializers.errWithCause(err);
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return {
      ...obj,
      type: typeof obj.type === "string" ? obj.type : typeof obj.name === "string" ? obj.name : "ErrorObject",
      message: typeof obj.message === "string" ? obj.message : String(err),
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
    };
  }
  return { type: typeof err, message: String(err) };
}

function withErrorContext(args: unknown[]): unknown[] {
  const site = captureLogSite();
  const first = args[0];

  if (first instanceof Error) {
    const payload: Record<string, unknown> = {
      err: first,
      caller: sourceLineFromStack(first.stack ?? "") ?? site.caller,
    };
    if (!first.stack) payload.traceback = site.traceback;
    return [payload, args[1] ?? first.message, ...args.slice(2)];
  }

  if (first && typeof first === "object" && !Array.isArray(first)) {
    const payload = { ...(first as Record<string, unknown>) };
    const errKey = payload.err !== undefined ? "err" : payload.error !== undefined ? "error" : undefined;
    if (errKey) {
      const errVal = payload[errKey];
      const errStack = hasStack(errVal) ? errVal.stack : undefined;
      payload.caller = sourceLineFromStack(errStack ?? site.traceback) ?? site.caller;
      if (!errStack) payload[errKey] = attachStack(errVal, site.traceback);
    } else {
      payload.caller = site.caller;
      payload.traceback = site.traceback;
    }
    return [payload, ...args.slice(1)];
  }

  return [{ caller: site.caller, traceback: site.traceback }, ...args];
}

/** Loaded only outside production. The runtime image omits this devDependency. */
function devPrettyStream(): DestinationStream {
  const pretty = require("pino-pretty") as (opts?: object) => DestinationStream;
  return pretty({
    colorize: true,
    translateTime: "SYS:standard",
    errorLikeObjectKeys: ["err", "error"],
    errorProps: "*",
    customPrettifiers: {
      traceback: (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value)),
    },
  });
}

/** Build a pino logger. Used by the process singleton and tests. */
export function createPinoLogger(options: CreatePinoLoggerOptions): Logger {
  const pinoOptions = {
    level: options.level,
    serializers: {
      err: serializeLogError,
      error: serializeLogError,
    },
    hooks: {
      logMethod(args: Parameters<Logger["error"]>, method: Logger["error"], level: number) {
        const next = level >= ERROR_LEVEL ? withErrorContext(args as unknown[]) : (args as unknown[]);
        method.apply(this, next as Parameters<Logger["error"]>);
      },
    },
  };

  if (options.destination) return pino(pinoOptions, options.destination);
  if (options.pretty) return pino(pinoOptions, devPrettyStream());
  return pino(pinoOptions);
}

/** Shared pino instance used by HTTP middleware and services. */
export function getLogger(): Logger {
  if (instance) return instance;

  const env = parseEnv();
  const level =
    env.LOG_LEVEL ?? (env.NODE_ENV === NodeEnv.PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG);

  instance = createPinoLogger({
    level,
    pretty: env.NODE_ENV !== NodeEnv.PRODUCTION,
  });

  return instance;
}

export function createServiceLogger(service: string): Logger {
  return getLogger().child({ service });
}
