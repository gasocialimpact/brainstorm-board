import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared boards need a Supabase project (see supabase/*.sql). Without one
// configured the app can't load or create boards.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sessions are only for the owner; everyone else uses board and folder links
// without signing in. PKCE returns from the sign-in email with ?code=..., which
// leaves the #b= / #f= part of the URL free for our own routes.
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, flowType: "pkce", detectSessionInUrl: true },
      })
    : null;

export const BUCKET = "board-files";
