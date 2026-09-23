import { createClient } from "@supabase/supabase-js";
import { parseEnv } from "../env-parser.js";

const env = parseEnv();

// Backend uses the service role key (bypasses RLS) since the server itself
// is the trusted context — per-user scoping is enforced via auth middleware
// + query filters. Never expose this key to a frontend client.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
