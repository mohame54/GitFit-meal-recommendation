import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { parseEnv } from "../env-parser.js";
import { HttpCodes } from "../types/https-codes.js";
import type { AppEnv } from "../lib/create-router.js";

const PUBLIC_PATHS = new Set(["/", "/health", "/doc", "/ui"]);

/**
 * Optional API-key gate. When API_KEY is configured, every non-public
 * route must send a matching X-Api-Key header.
 */
export const apiKeyAuth: MiddlewareHandler<AppEnv> = createMiddleware(async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path) || c.req.path.startsWith("/ui")) {
    return next();
  }

  const { API_KEY } = parseEnv();
  if (!API_KEY) {
    return next();
  }

  const provided = c.req.header("x-api-key");
  if (!provided || provided !== API_KEY) {
    return c.json({ error: "Unauthorized: missing or invalid X-Api-Key" }, HttpCodes.UNAUTHORIZED);
  }

  return next();
});

/**
 * Trusted user identity from X-User-Id.
 * Handlers should prefer c.get("userId") over client-supplied body/query
 * userId when this header is present.
 */
export const userContext: MiddlewareHandler<AppEnv> = createMiddleware(async (c, next) => {
  const headerUserId = c.req.header("x-user-id")?.trim();
  if (headerUserId) {
    c.set("userId", headerUserId);
  }
  await next();
});

/**
 * Resolve the trusted user id for a request.
 * Prefer X-User-Id; fall back to an explicit parameter (query/body) for
 * OpenAPI/demo callers. When both are present they must match.
 */
export function resolveUserId(
  headerUserId: string | undefined,
  explicitUserId: string | undefined,
): string {
  if (headerUserId && explicitUserId && headerUserId !== explicitUserId) {
    throw new UserIdMismatchError(headerUserId, explicitUserId);
  }
  const userId = headerUserId ?? explicitUserId;
  if (!userId) {
    throw new MissingUserIdError();
  }
  return userId;
}

export class UserIdMismatchError extends Error {
  constructor(header: string, explicit: string) {
    super(`X-User-Id (${header}) does not match provided userId (${explicit})`);
    this.name = "UserIdMismatchError";
  }
}

export class MissingUserIdError extends Error {
  constructor() {
    super("userId is required (pass X-User-Id header or userId parameter)");
    this.name = "MissingUserIdError";
  }
}
