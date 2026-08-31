const DB_NAME = "gymflow-storage-v1";
const DB_VERSION = 2;
const LOCAL_STORE = "local_state";
const CLOUD_STORE = "cloud_state";
const OUTBOX_STORE = "pending_ops";
const LOCAL_KEY = "default";
const LEGACY_LOCAL_KEY = "gymflow-data-v2";
const WAL_PREFIX = "gymflow-emergency-wal-v1:";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE)) db.createObjectStore(LOCAL_STORE);
      if (!db.objectStoreNames.contains(CLOUD_STORE)) db.createObjectStore(CLOUD_STORE);
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function withStore(storeName, mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Error de almacenamiento local."));
      tx.onabort = () => reject(tx.error || new Error("La operación de almacenamiento fue cancelada."));
    });
  } finally {
    db.close();
  }
}

export const getLocalState = () => withStore(LOCAL_STORE, "readonly", (store) => store.get(LOCAL_KEY));
export const setLocalState = (value) => withStore(LOCAL_STORE, "readwrite", (store) => store.put(value, LOCAL_KEY));
export const getCloudState = (userId) => withStore(CLOUD_STORE, "readonly", (store) => store.get(userId));
export const setCloudState = (userId, value) => withStore(CLOUD_STORE, "readwrite", (store) => store.put(value, userId));
export const clearCloudState = (userId) => withStore(CLOUD_STORE, "readwrite", (store) => store.delete(userId));
export const clearAllCloudStates = () => withStore(CLOUD_STORE, "readwrite", (store) => store.clear());

const outboxKey = (userId, operationId) => `${userId}:${operationId}`;
const walKey = (userId) => `${WAL_PREFIX}${userId}`;

export function getWalOperations(userId) {
  if (!userId || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(walKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stagePendingOperations(userId, operations) {
  if (!userId || !operations?.length || typeof localStorage === "undefined") return;
  const existing = getWalOperations(userId);
  const byId = new Map(existing.filter((item) => item?.id).map((item) => [item.id, item]));
  const queuedAt = Date.now();
  operations.forEach((operation, index) => {
    byId.set(operation.id, { ...operation, userId, queuedAt: queuedAt + index });
  });
  localStorage.setItem(walKey(userId), JSON.stringify([...byId.values()]));
}

export function unstagePendingOperations(userId, operationIds) {
  if (!userId || !operationIds?.length || typeof localStorage === "undefined") return;
  const ids = new Set(operationIds);
  const remaining = getWalOperations(userId).filter((operation) => !ids.has(operation.id));
  if (remaining.length) localStorage.setItem(walKey(userId), JSON.stringify(remaining));
  else localStorage.removeItem(walKey(userId));
}

export async function enqueuePendingOperations(userId, operations) {
  if (!userId || !operations?.length) return;
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      const store = tx.objectStore(OUTBOX_STORE);
      const queuedAt = Date.now();
      operations.forEach((operation, index) => {
        store.put({ ...operation, userId, queuedAt: operation.queuedAt || queuedAt + index }, outboxKey(userId, operation.id));
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudieron guardar los movimientos pendientes."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló el guardado de movimientos pendientes."));
    });
  } finally {
    db.close();
  }
}

export async function recoverWalOperations(userId) {
  const wal = getWalOperations(userId);
  if (!wal.length) return 0;
  await enqueuePendingOperations(userId, wal);
  unstagePendingOperations(userId, wal.map((operation) => operation.id));
  return wal.length;
}

export async function getPendingOperations(userId) {
  if (!userId) return [];
  const all = await withStore(OUTBOX_STORE, "readonly", (store) => store.getAll());
  return (all || [])
    .filter((operation) => operation?.userId === userId)
    .sort((a, b) => Number(a.queuedAt || 0) - Number(b.queuedAt || 0));
}

export async function deletePendingOperations(userId, operationIds) {
  if (!userId || !operationIds?.length) return;
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      const store = tx.objectStore(OUTBOX_STORE);
      operationIds.forEach((operationId) => store.delete(outboxKey(userId, operationId)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudieron confirmar los movimientos sincronizados."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló la confirmación de sincronización."));
    });
  } finally {
    db.close();
  }
}

export async function clearPendingOperations(userId) {
  const pending = await getPendingOperations(userId);
  await deletePendingOperations(userId, pending.map((operation) => operation.id));
  unstagePendingOperations(userId, getWalOperations(userId).map((operation) => operation.id));
}

export async function migrateLegacyLocalState() {
  if (typeof localStorage === "undefined") return null;
  const existing = await getLocalState().catch(() => null);
  if (existing) return existing;

  let legacy = null;
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    legacy = raw ? JSON.parse(raw) : null;
  } catch {
    legacy = null;
  }

  if (legacy) {
    await setLocalState(legacy);
    try { localStorage.removeItem(LEGACY_LOCAL_KEY); } catch { /* no-op */ }
  }
  return legacy;
}
