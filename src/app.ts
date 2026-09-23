import createApp from "./lib/create-app.js";
import indexRouter from "./routes/index.route.js";
import { agentRouter } from "./routes/agent/agent.index.js";
import { feedbackRouter } from "./routes/feedback/feedback.index.js";
import { recommendationsRouter } from "./routes/recommendations/recommendations.index.js";
import { profilesRouter } from "./routes/profiles/profiles.index.js";
import { constraintsRouter } from "./routes/constraints/constraints.index.js";
import { preferencesRouter } from "./routes/preferences/preferences.index.js";
import { historyRouter } from "./routes/history/history.index.js";
import { recipesRouter } from "./routes/recipes/recipes.index.js";
import { generationRouter } from "./routes/generation/generation.index.js";

const app = createApp();

app.route("/", indexRouter);
app.route("/", profilesRouter);
app.route("/", constraintsRouter);
app.route("/", preferencesRouter);
app.route("/", recipesRouter);
app.route("/", recommendationsRouter);
app.route("/", feedbackRouter);
app.route("/", historyRouter);
app.route("/", generationRouter);
app.route("/", agentRouter);

export default app;
