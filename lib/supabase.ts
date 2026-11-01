import { createClient } from "@supabase/supabase-js";

// Keys come from the environment (.env.local locally, project settings on the host).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// null when the env vars are missing, so the app can show a message instead of crashing.
export const supabase = url && key ? createClient(url, key) : null;
