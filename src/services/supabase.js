import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "ubfqwmhxkjtqdcfnsmwe";
const DEFAULT_SUPABASE_URL = `https://${EXPECTED_PROJECT_REF}.supabase.co`;
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZnF3bWh4a2p0cWRjZm5zbXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTAxODEsImV4cCI6MjA5NTE2NjE4MX0.03WBL3APZucAM1-ufuSgEbuXyYjmM0keDAjG4FRtfVo";

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const envMatchesProject = Boolean(envUrl && envKey && envUrl.includes(EXPECTED_PROJECT_REF));

// GymFlow is intentionally pinned to its own Supabase project. This prevents
// stale Vercel environment variables from silently connecting the app to a
// different Supabase project.
const supabaseUrl = envMatchesProject ? envUrl : DEFAULT_SUPABASE_URL;
const supabaseAnonKey = envMatchesProject ? envKey : DEFAULT_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getSupabasePublicConfig = () => ({
  url: supabaseUrl || "",
  projectRef: EXPECTED_PROJECT_REF,
  configured: supabaseConfigured,
});
