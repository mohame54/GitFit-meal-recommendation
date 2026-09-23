import { swaggerUI } from "@hono/swagger-ui";
import notFound from "../middlewares/notfound.js";
import onError from "../middlewares/error.js";
import { createLogger } from "../middlewares/loggers.js";
import { apiKeyAuth, userContext } from "../middlewares/auth.js";
import { createRouter } from "./create-router.js";

export default function createApp() {
  const app = createRouter();

  app.use(createLogger());
  app.use("*", apiKeyAuth);
  app.use("*", userContext);

  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      title: "Meals Personalization API",
      version: "1.0.0",
      description:
        "Personalization, recommendation, and AI-generation engine for meals. " +
        "Send X-Api-Key when API_KEY is configured, and prefer X-User-Id for trusted identity.",
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
