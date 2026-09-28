import { OpenAPIHono, type RouteConfig, type RouteHandler } from "@hono/zod-openapi";
import type { Env } from "hono-pino";
import { HttpCodes } from "../types/https-codes.js";

export type AppEnv = {
  Variables: Env["Variables"] & {
    /** Meals profile id from JWT `user_metadata.meals_profile_id`. */
    userId?: string;
    /** Supabase Auth user id from JWT `sub`. */
    authUserId?: string;
  };
};

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: result.error.errors.map((e) => e.message).join("; ") || "Validation error" },
          HttpCodes.BAD_REQUEST,
        );
      }
    },
  });
}

export type ApiRouterHandler<R extends RouteConfig> = RouteHandler<R, AppEnv>;
