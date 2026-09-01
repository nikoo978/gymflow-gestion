import { supabase } from "./supabase";

export async function getReportSnapshot({ branch, start, end, previousStart, previousEnd, granularity = "day", limit = 500 }) {
  if (!supabase) return { report: null, error: new Error("Supabase no está configurado.") };
  const { data, error } = await supabase.rpc("gf_get_report_snapshot", {
    p_branch: branch,
    p_start: start,
    p_end: end,
    p_previous_start: previousStart,
    p_previous_end: previousEnd,
    p_granularity: granularity,
    p_limit: limit,
  });
  return { report: data || null, error: error || null };
}

export async function getScalingStatus() {
  if (!supabase) return { status: null, error: new Error("Supabase no está configurado.") };
  const { data, error } = await supabase.rpc("gf_scaling_status");
  return { status: data || null, error: error || null };
}
