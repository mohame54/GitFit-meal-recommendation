import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { resetEnvCache } from "../env-parser.js";
import type { AppEnv } from "../lib/create-router.js";
import { resetJwksCache, verifySupabaseAccessToken } from "../lib/supabase-jwt.js";
import { supabaseJwtAuth } from "./auth.js";

const JWT_SECRET = "test-supabase-jwt-secret-at-least-32-chars";
const SUPABASE_URL = "https://example.supabase.co";
const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const MEALS_PROFILE_ID = "22222222-2222-4222-8222-222222222222";

function seedEnv(): void {
  process.env.PORT = "3000";
  process.env.NODE_ENV = "dev";
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SUPABASE_JWT_ALGORITHMS = "HS256";
  process.env.NUTRIENT_LLM_NAME = "gemini-2.5-flash";
  process.env.FEEDBACK_LLM_NAME = "gemini-2.5-flash";
  process.env.MAIN_AGENT_LLM_NAME = "gemini-2.5-flash";
  process.env.ONBOARDING_AGENT_LLM_NAME = "gemini-2.5-flash";
  process.env.RECIPE_GENERATION_LLM_NAME = "gemini-2.5-flash";
  process.env.GOOGLE_API_KEY = "test-google-key";
  delete process.env.API_KEY;
  delete process.env.CORS_ORIGINS;
  resetEnvCache();
  resetJwksCache();
}

async function signAccessToken(claims: {
  sub?: string;
  mealsProfileId?: string | null;
  expOffsetSec?: number;
}): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({
    ...(claims.mealsProfileId === null
      ? { user_metadata: {} }
      : {
          user_metadata: {
            meals_profile_id: claims.mealsProfileId ?? MEALS_PROFILE_ID,
          },
        }),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setSubject(claims.sub ?? AUTH_USER_ID)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + (claims.expOffsetSec ?? 3600));

  return builder.sign(secret);
}

function createTestApp() {
  const app = new Hono<AppEnv>();
  app.use("*", supabaseJwtAuth);
  app.get("/api/recommendations", (c) =>
    c.json({ userId: c.get("userId"), authUserId: c.get("authUserId") }),
  );
  app.get("/api/profiles/:profileId", (c) =>
    c.json({ userId: c.get("userId"), path: c.req.param("profileId") }),
  );
  app.post("/api/profiles", (c) => c.json({ created: true }, 201));
  app.get("/api/recipes", (c) => c.json({ list: true }));
  return app;
}

describe("supabaseJwtAuth", () => {
  beforeEach(() => {
    seedEnv();
  });

  it("sets meals profile id and auth user id from a valid Bearer token", async () => {
    const token = await signAccessToken({});
    const app = createTestApp();
    const res = await app.request("/api/recommendations", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      userId: MEALS_PROFILE_ID,
      authUserId: AUTH_USER_ID,
    });
  });

  it("returns 401 when Authorization is missing", async () => {
    const app = createTestApp();
    const res = await app.request("/api/recommendations");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Bearer/i);
  });

  it("returns 401 when meals_profile_id is missing", async () => {
    const token = await signAccessToken({ mealsProfileId: null });
    const app = createTestApp();
    const res = await app.request("/api/recommendations", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/meals_profile_id/i);
  });

  it("returns 403 when profile path id does not match token", async () => {
    const token = await signAccessToken({});
    const app = createTestApp();
    const res = await app.request(
      "/api/profiles/33333333-3333-4333-8333-333333333333",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/mismatch/i);
  });

  it("allows matching profile path with a valid token", async () => {
    const token = await signAccessToken({});
    const app = createTestApp();
    const res = await app.request(`/api/profiles/${MEALS_PROFILE_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("allows POST /api/profiles without a user Bearer token", async () => {
    const app = createTestApp();
    const res = await app.request("/api/profiles", { method: "POST" });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ created: true });
  });

  it("allows GET /api/recipes without a user Bearer token", async () => {
    const app = createTestApp();
    const res = await app.request("/api/recipes");
    expect(res.status).toBe(200);
  });
});

describe("verifySupabaseAccessToken", () => {
  beforeEach(() => {
    seedEnv();
  });

  it("rejects expired tokens", async () => {
    const token = await signAccessToken({ expOffsetSec: -10 });
    await expect(verifySupabaseAccessToken(token)).rejects.toThrow(/Invalid or expired/i);
  });

  it("rejects algorithms not listed in SUPABASE_JWT_ALGORITHMS", async () => {
    process.env.SUPABASE_JWT_ALGORITHMS = "ES256";
    resetEnvCache();
    const token = await signAccessToken({});
    await expect(verifySupabaseAccessToken(token)).rejects.toThrow(/Unsupported token algorithm: HS256/i);
  });
});
