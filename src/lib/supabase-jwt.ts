import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { parseEnv } from "../env-parser.js";

export type VerifiedMealsToken = {
  /** Supabase Auth user id (`sub`). */
  authUserId: string;
  /** Meals profile id from `user_metadata.meals_profile_id`. */
  mealsProfileId: string;
};

export class JwtVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtVerificationError";
  }
}

type UserMetadata = {
  meals_profile_id?: unknown;
};

/** HMAC algorithms verified with SUPABASE_JWT_SECRET. */
const HMAC_ALGS = new Set(["HS256", "HS384", "HS512"]);

/** Asymmetric algorithms verified via Supabase JWKS (includes ECC P-256 → ES256). */
const ASYMMETRIC_ALGS = new Set([
  "ES256",
  "ES384",
  "ES512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
]);

function issuerFromSupabaseUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
}

function readMealsProfileId(payload: JWTPayload): string {
  const meta = payload.user_metadata as UserMetadata | undefined;
  const id = meta?.meals_profile_id;
  if (typeof id !== "string" || !id.trim()) {
    throw new JwtVerificationError("Missing meals_profile_id in token");
  }
  return id.trim();
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(supabaseUrl: string) {
  if (!jwks) {
    const url = new URL(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

/** Test helper — clears the cached JWKS client. */
export function resetJwksCache(): void {
  jwks = null;
}

/**
 * Verify a Supabase access token.
 * Reads allowed algorithms from SUPABASE_JWT_ALGORITHMS, rejects others
 * before signature verification, then verifies via HMAC secret or JWKS.
 */
export async function verifySupabaseAccessToken(token: string): Promise<VerifiedMealsToken> {
  const { SUPABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_JWT_ALGORITHMS } = parseEnv();
  const issuer = issuerFromSupabaseUrl(SUPABASE_URL);
  const allowedAlgs = new Set(SUPABASE_JWT_ALGORITHMS);

  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw new JwtVerificationError("Invalid token");
  }

  const alg = typeof header.alg === "string" ? header.alg.trim().toUpperCase() : "";
  if (!alg) {
    throw new JwtVerificationError("Token missing algorithm");
  }
  if (!allowedAlgs.has(alg)) {
    throw new JwtVerificationError(
      `Unsupported token algorithm: ${alg} (allowed: ${SUPABASE_JWT_ALGORITHMS.join(", ")})`,
    );
  }

  const verifyOptions = {
    issuer,
    audience: "authenticated",
    algorithms: [alg] as string[],
  };

  let payload: JWTPayload;
  try {
    if (HMAC_ALGS.has(alg)) {
      if (!SUPABASE_JWT_SECRET) {
        throw new JwtVerificationError(`Server is not configured for ${alg} tokens`);
      }
      const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
      ({ payload } = await jwtVerify(token, secret, verifyOptions));
    } else if (ASYMMETRIC_ALGS.has(alg)) {
      ({ payload } = await jwtVerify(token, getJwks(SUPABASE_URL), verifyOptions));
    } else {
      throw new JwtVerificationError(`No verifier configured for algorithm: ${alg}`);
    }
  } catch (err) {
    if (err instanceof JwtVerificationError) throw err;
    throw new JwtVerificationError("Invalid or expired token");
  }

  const authUserId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!authUserId) {
    throw new JwtVerificationError("Token missing subject");
  }

  return {
    authUserId,
    mealsProfileId: readMealsProfileId(payload),
  };
}
