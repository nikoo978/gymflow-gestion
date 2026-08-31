const DB_NAME = "gymflow-storage-v1";
const DB_VERSION = 1;
const LOCAL_STORE = "local_state";
const CLOUD_STORE = "cloud_state";
const LOCAL_KEY = "default";
const LEGACY_LOCAL_KEY = "gymflow-data-v2";

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
