import { supabase } from "./supabase";

const noSupabase = () => new Error("Supabase no configurado");
const HASH_PREFIX = "display=";

export function displayKeyFromHash(hash = typeof window !== "undefined" ? window.location.hash : "") {
  const value = String(hash || "").replace(/^#/, "");
  if (!value.startsWith(HASH_PREFIX)) return "";
  return decodeURIComponent(value.slice(HASH_PREFIX.length)).trim();
}

export function buildAccessDisplayUrl(displayKey) {
  if (typeof window === "undefined" || !displayKey) return "";
  return `${window.location.origin}/pantalla-acceso#${HASH_PREFIX}${encodeURIComponent(displayKey)}`;
}

export async function getAccessDisplayKey() {
  if (!supabase) return { displayKey: "", error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_access_display_key");
  return { displayKey: data || "", error };
}

export async function getAccessDisplayState(displayKey) {
  if (!supabase || !displayKey) return { access: null, error: !supabase ? noSupabase() : new Error("Clave de pantalla faltante") };
  const { data, error } = await supabase.rpc("gf_get_access_display_state", { p_display_key: displayKey });
  return { access: data || null, error };
}

export async function publishGlobalAccessDisplay(access) {
  if (!supabase) return { ok: false, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_publish_access_display", { p_event: access || {} });
  return { ok: Boolean(data) && !error, error };
}

export function subscribeAccessDisplay(displayKey, onAccess, onStatus) {
  if (!supabase || !displayKey) return () => undefined;
  const topic = `access-display:${displayKey}`;
  const channel = supabase
    .channel(topic)
    .on("broadcast", { event: "access-result" }, ({ payload }) => {
      if (payload) onAccess?.(payload);
    })
    .subscribe((status, error) => onStatus?.(status, error));

  return () => { supabase.removeChannel(channel); };
}
