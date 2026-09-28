import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import notFound from "../middlewares/notfound.js";
import onError from "../middlewares/error.js";
import { createLogger } from "../middlewares/loggers.js";
import { apiKeyAuth, supabaseJwtAuth } from "../middlewares/auth.js";
import { parseEnv } from "../env-parser.js";
import { createRouter } from "./create-router.js";

function corsOrigin(): string | string[] | ((origin: string) => string | undefined | null) {
  const { CORS_ORIGINS } = parseEnv();
  if (!CORS_ORIGINS?.trim()) {
    return (origin: string) => origin || undefined;
  }
  const allowed = CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return (origin: string) => (allowed.includes(origin) ? origin : undefined);
}

export default function createApp() {
  const app = createRouter();

  app.use(
    "*",
    cors({
      origin: corsOrigin(),
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "X-Api-Key"],
      credentials: false,
    }),
  );
  app.use(createLogger());
  app.use("*", apiKeyAuth);
  app.use("*", supabaseJwtAuth);

  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      title: "Meals Personalization API",
      version: "1.0.0",
      description:
        "Personalization, recommendation, and AI-generation engine for meals. " +
        "Send Authorization: Bearer <Supabase access token> on user routes. " +
        "Send X-Api-Key when API_KEY is configured. " +
        "POST /api/profiles is a service-key path (no user JWT).",
    },
    tags: [
      { name: "General", description: "General and health endpoints" },
      { name: "Profiles", description: "User profiles" },
      { name: "Constraints", description: "Hard user constraints (allergies, diet)" },
      { name: "Preferences", description: "Soft weighted preferences" },
      { name: "Recipes", description: "Recipe catalog" },
      { name: "Recommendations", description: "Personalized recipe recommendations" },
      { name: "Feedback", description: "Recipe feedback and preference learning" },
      { name: "History", description: "Recommendation and feedback history" },
      { name: "Generation", description: "AI recipe generation with schema validation" },
      { name: "Agent", description: "Stateless chat with the main router agent (onboarding, nutrition, profile updates)" },
    ],
  });
  app.get("/ui", swaggerUI({ url: "/doc" }));
  app.notFound(notFound);
  app.onError(onError);

  return app;
}
