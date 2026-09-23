import { serve } from "@hono/node-server";
import app from "./app.js";
import { parseEnv } from "./env-parser.js";

const env = parseEnv();
const hostname = process.env.HOST ?? "0.0.0.0";

serve({
  fetch: app.fetch,
  hostname,
  port: env.PORT,
}, (info) => {
  console.log(`Server is running on http://${info.address}:${info.port}`);
});
