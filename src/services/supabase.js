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

// El alta de una cuenta debe avisar al Admin master incluso cuando Supabase
// exige confirmación de email y todavía no entrega una sesión al usuario.
// El endpoint sólo acepta userId+email que Supabase pueda verificar mediante
// una RPC security-definer y nunca confía en datos de gimnasio enviados aquí.
if (supabase?.auth?.signUp) {
  const originalSignUp = supabase.auth.signUp.bind(supabase.auth);
  supabase.auth.signUp = async (...args) => {
    const result = await originalSignUp(...args);
    const created = result?.data?.user;
    if (created?.id && created?.email && !result?.error) {
      fetch("/api/account-events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ userId: created.id, email: created.email }),
        keepalive: true,
      }).catch(() => undefined);
    }
    return result;
  };
}

export const getSupabasePublicConfig = () => ({
  url: supabaseUrl || "",
  projectRef: EXPECTED_PROJECT_REF,
  configured: supabaseConfigured,
});
