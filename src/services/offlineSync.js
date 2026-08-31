import { supabase } from "./supabase";
import {
  deletePendingOperations,
  enqueuePendingOperations,
  getPendingOperations,
} from "./storage";

const COLLECTIONS = ["people", "transactions", "accesses", "closures", "notificationLog"];
const DEVICE_KEY = "gymflow-device-id";

const clone = (value) => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function getDeviceId() {
  if (typeof localStorage === "undefined") return "unknown-device";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function operationBase(deviceId) {
  return {
    id: crypto.randomUUID(),
    deviceId,
    createdAt: new Date().toISOString(),
  };
}

function objectPatch(before = {}, after = {}) {
  const patch = {};
  const unset = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    if (same(before?.[key], after?.[key])) continue;
    if (!Object.prototype.hasOwnProperty.call(after || {}, key)) unset.push(key);
    else patch[key] = clone(after[key]);
  }
  return { patch, unset };
}

export function buildStateOperations(before, after, deviceId = getDeviceId()) {
  const operations = [];

  for (const collection of COLLECTIONS) {
    const oldItems = Array.isArray(before?.[collection]) ? before[collection] : [];
    const newItems = Array.isArray(after?.[collection]) ? after[collection] : [];
    const oldById = new Map(oldItems.filter((item) => item?.id).map((item) => [String(item.id), item]));
    const newById = new Map(newItems.filter((item) => item?.id).map((item) => [String(item.id), item]));

    for (const [recordId, item] of newById) {
      const previous = oldById.get(recordId);
      if (!previous) {
        operations.push({ ...operationBase(deviceId), action: "upsert", collection, recordId, payload: clone(item) });
        continue;
      }
      if (!same(previous, item)) {
        const { patch, unset } = objectPatch(previous, item);
        operations.push({
          ...operationBase(deviceId),
          action: "patch",
          collection,
          recordId,
          payload: patch,
          unset,
          fallback: clone(item),
        });
      }
    }

    for (const [recordId, previous] of oldById) {
      if (!newById.has(recordId)) {
        operations.push({ ...operationBase(deviceId), action: "delete", collection, recordId, base: clone(previous) });
      }
    }
  }

  if (!same(before?.activeBranch, after?.activeBranch)) {
    operations.push({ ...operationBase(deviceId), action: "set", key: "activeBranch", value: clone(after?.activeBranch) });
  }

  if (!same(before?.notificationPreferences, after?.notificationPreferences)) {
    const { patch, unset } = objectPatch(before?.notificationPreferences || {}, after?.notificationPreferences || {});
    operations.push({ ...operationBase(deviceId), action: "merge", key: "notificationPreferences", payload: patch, unset });
  }

  return operations;
}

function applyPatch(record, operation) {
  const next = { ...(record || operation.fallback || {}), ...(operation.payload || {}) };
  for (const key of operation.unset || []) delete next[key];
  if (!next.id && operation.recordId) next.id = operation.recordId;
  return next;
}

export function applyOperationsLocally(state, operations) {
  const next = clone(state || {});

  for (const operation of operations || []) {
    if ((operation.action === "upsert" || operation.action === "patch") && COLLECTIONS.includes(operation.collection)) {
      const items = Array.isArray(next[operation.collection]) ? [...next[operation.collection]] : [];
      const index = items.findIndex((item) => String(item?.id) === String(operation.recordId));
      const value = operation.action === "patch"
        ? applyPatch(index >= 0 ? items[index] : null, operation)
        : clone(operation.payload);
      if (index >= 0) items[index] = value;
      else items.unshift(value);
      next[operation.collection] = items;
      continue;
    }

    if (operation.action === "delete" && COLLECTIONS.includes(operation.collection)) {
      const items = Array.isArray(next[operation.collection]) ? next[operation.collection] : [];
      next[operation.collection] = items.filter((item) => String(item?.id) !== String(operation.recordId));
      continue;
    }

    if (operation.action === "set" && operation.key === "activeBranch") {
      next.activeBranch = clone(operation.value);
      continue;
    }

    if (operation.action === "merge" && operation.key === "notificationPreferences") {
      const prefs = { ...(next.notificationPreferences || {}), ...(operation.payload || {}) };
      for (const key of operation.unset || []) delete prefs[key];
      next.notificationPreferences = prefs;
    }
  }

  return next;
}

export async function queueStateOperations(userId, operations) {
  if (!userId || !operations?.length) return 0;
  await enqueuePendingOperations(userId, operations);
  return operations.length;
}

async function refreshAuthIfNeeded(error) {
  if (!error) return false;
  const text = String(error?.message || "");
  if (error.status !== 401 && !/jwt|token|auth/i.test(text)) return false;
  await supabase.auth.refreshSession().catch(() => undefined);
  return true;
}

async function fetchRemoteState(userId) {
  let result = await supabase
    .from("gf_user_state")
    .select("data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error && await refreshAuthIfNeeded(result.error)) {
    result = await supabase
      .from("gf_user_state")
      .select("data,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
  }
  if (result.error) throw result.error;
  return result.data || null;
}

async function insertInitialState(userId, state) {
  let result = await supabase
    .from("gf_user_state")
    .insert({ user_id: userId, data: state })
    .select("data,updated_at")
    .maybeSingle();

  if (result.error && await refreshAuthIfNeeded(result.error)) {
    result = await supabase
      .from("gf_user_state")
      .insert({ user_id: userId, data: state })
      .select("data,updated_at")
      .maybeSingle();
  }
  return result;
}

async function optimisticApply(userId, operations) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const remote = await fetchRemoteState(userId);
    const merged = applyOperationsLocally(remote?.data || {}, operations);

    if (!remote) {
      const created = await insertInitialState(userId, merged);
      if (!created.error && created.data) return created.data.data;
      if (created.error?.code === "23505") continue;
      if (created.error) throw created.error;
      continue;
    }

    let query = supabase
      .from("gf_user_state")
      .update({ data: merged })
      .eq("user_id", userId);

    if (remote.updated_at) query = query.eq("updated_at", remote.updated_at);

    let result = await query.select("data,updated_at");
    if (result.error && await refreshAuthIfNeeded(result.error)) {
      query = supabase.from("gf_user_state").update({ data: merged }).eq("user_id", userId);
      if (remote.updated_at) query = query.eq("updated_at", remote.updated_at);
      result = await query.select("data,updated_at");
    }
    if (result.error) throw result.error;
    if (Array.isArray(result.data) && result.data.length === 1) return result.data[0].data;
  }

  throw new Error("No se pudo conciliar el estado cloud porque cambió repetidamente. Se reintentará sin descartar ningún movimiento local.");
}

export async function flushPendingOperations(userId, limit = 200) {
  if (!userId || !supabase) return { remoteState: null, sent: 0 };
  const pending = (await getPendingOperations(userId)).slice(0, limit);
  if (!pending.length) return { remoteState: null, sent: 0 };

  const remoteState = await optimisticApply(userId, pending);
  await deletePendingOperations(userId, pending.map((operation) => operation.id));
  return { remoteState, sent: pending.length };
}

export const pendingOperations = (userId) => getPendingOperations(userId);
