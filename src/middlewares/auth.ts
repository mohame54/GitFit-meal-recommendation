import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { parseEnv } from "../env-parser.js";
import { JwtVerificationError, verifySupabaseAccessToken } from "../lib/supabase-jwt.js";
import { HttpCodes } from "../types/https-codes.js";
import type { AppEnv } from "../lib/create-router.js";

const PUBLIC_PATHS = new Set(["/", "/health", "/doc", "/ui"]);

/**
 * Paths that accept X-Api-Key (when configured) but do not require a
 * Supabase user Bearer token. Signup profile creation and catalog/ingest
 * stay on the service-key path.
 */
function isJwtExempt(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/ui")) return true;
  if (method === "POST" && path === "/api/profiles") return true;
  if (method === "GET" && path === "/api/recipes") return true;
  if (method === "POST" && path.startsWith("/api/recipes/ingest")) return true;
  return false;
}

/**
 * Browser-facing meals routes that must present a verified Supabase JWT.
 */
function requiresJwt(method: string, path: string): boolean {
  if (isJwtExempt(method, path)) return false;
  if (!path.startsWith("/api/")) return false;
  return true;
}

/**
 * Optional API-key gate. When API_KEY is configured, every non-public
 * route must send a matching X-Api-Key header.
 */
export const apiKeyAuth: MiddlewareHandler<AppEnv> = createMiddleware(async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

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
 * Verify Supabase access token and set trusted identity on the context.
 * The meals profile id and the auth user id are both the JWT `sub` claim.
 */
export const supabaseJwtAuth: MiddlewareHandler<AppEnv> = createMiddleware(async (c, next) => {
  if (!requiresJwt(c.req.method, c.req.path)) {
    return next();
  }

  const header = c.req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return c.json(
      { error: "Unauthorized: missing or malformed Authorization Bearer token" },
      HttpCodes.UNAUTHORIZED,
    );
  }

  const token = header.slice(7).trim();
  if (!token) {
    return c.json(
      { error: "Unauthorized: missing or malformed Authorization Bearer token" },
      HttpCodes.UNAUTHORIZED,
    );
  }

  try {
    const verified = await verifySupabaseAccessToken(token);
    c.set("userId", verified.mealsProfileId);
    c.set("authUserId", verified.authUserId);
  } catch (err) {
    const message =
      err instanceof JwtVerificationError ? err.message : "Invalid or expired token";
    return c.json({ error: message }, HttpCodes.UNAUTHORIZED);
  }

  // Path profile id must match the token subject.
  const profilePathMatch = c.req.path.match(/^\/api\/profiles\/([^/]+)$/);
  if (profilePathMatch && (c.req.method === "GET" || c.req.method === "PATCH")) {
    const pathProfileId = decodeURIComponent(profilePathMatch[1] ?? "").trim();
    if (pathProfileId !== c.get("userId")) {
      return c.json({ error: "Forbidden: profile id mismatch" }, HttpCodes.FORBIDDEN);
    }
  }

  return next();
});

/**
 * Return the trusted meals profile id from the verified JWT.
 * Throws if middleware did not set it (caller is on a JWT-required route).
 */
export function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new MissingUserIdError();
  }
  return userId;
}

/**
 * When a client still sends body/query userId, it must equal the token
 * profile id. Prefer the token; never trust the client value alone.
 */
export function assertOptionalUserIdMatches(
  tokenUserId: string,
  explicitUserId: string | undefined,
): void {
  if (explicitUserId && explicitUserId !== tokenUserId) {
    throw new UserIdMismatchError(tokenUserId, explicitUserId);
  }
}

export class UserIdMismatchError extends Error {
  constructor(token: string, explicit: string) {
    super(`Token profile (${token}) does not match provided userId (${explicit})`);
    this.name = "UserIdMismatchError";
  }
}

export class MissingUserIdError extends Error {
  constructor() {
    super("Authenticated user is required");
    this.name = "MissingUserIdError";
  }
}
