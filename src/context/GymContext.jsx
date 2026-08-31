"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import { getCloudState, getLocalState, migrateLegacyLocalState, setCloudState, setLocalState } from "../services/storage";
import { cancelMembershipNotifications, scheduleMembershipNotifications, sendRemoteEvent } from "../services/notifications";
import { useAuth } from "./AuthContext";

const GymContext = createContext(null);
const iso = (days = 0) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const defaultNotificationPreferences = {
  newClient: true,
  income: true,
  withdrawal: true,
  expense: true,
  membershipExpiring: true,
  membershipExpired: true,
  clientAccess: false,
  staffAccess: false,
  deniedAccess: true,
  manualAccess: true,
};

const startOfWeek = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
};

export function planUsage(person, accesses, now = new Date()) {
  if (person?.plan !== "3 días") return { usedDays: 0, limitReached: false, alreadyEnteredToday: false };
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const today = now.toISOString().slice(0, 10);
  const days = new Set(accesses
    .filter((access) => access.personId === person.id && access.allowed && !access.manual)
    .filter((access) => { const date = new Date(access.date); return date >= weekStart && date < weekEnd; })
    .map((access) => access.date.slice(0, 10)));
  return { usedDays: days.size, alreadyEnteredToday: days.has(today), limitReached: days.size >= 3 && !days.has(today) };
}

const seed = {
  branches: [{ id: "centro", name: "Junín" }, { id: "norte", name: "Chacabuco" }],
  activeBranch: "centro",
  people: [],
  transactions: [],
  accesses: [],
  closures: [],
  notificationPreferences: defaultNotificationPreferences,
  notificationLog: [],
  pushTokens: [],
};

const normalizeData = (value) => ({
  ...seed,
  ...(value || {}),
  branches: Array.isArray(value?.branches) && value.branches.length ? value.branches : seed.branches,
  people: Array.isArray(value?.people) ? value.people : [],
  transactions: Array.isArray(value?.transactions) ? value.transactions : [],
  accesses: Array.isArray(value?.accesses) ? value.accesses : [],
  closures: Array.isArray(value?.closures) ? value.closures : [],
  notificationPreferences: { ...defaultNotificationPreferences, ...value?.notificationPreferences },
  notificationLog: value?.notificationLog || [],
  pushTokens: value?.pushTokens || [],
});

const showDeviceNotification = (title, body) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  navigator.serviceWorker?.ready.then((registration) => registration.showNotification(title, { body, icon: "/favicon.svg", badge: "/favicon.svg" })).catch(() => undefined);
};

export function statusOf(person) {
  if (person.role === "Profesor") return "Vigente";
  if (!person.expiry) return "Vencida";
  const days = Math.ceil((new Date(`${person.expiry}T23:59:59`) - new Date()) / 86400000);
  return days < 0 ? "Vencida" : days <= 7 ? "Por vencer" : "Vigente";
}

export function GymProvider({ children }) {
  const { user, isCloud, isLocal } = useAuth();
  const [data, setData] = useState(seed);
  const [sync, setSync] = useState("Cargando");
  const [storageReady, setStorageReady] = useState(false);
  const loadedIdentity = useRef("");

  useEffect(() => {
    let active = true;
    const identity = isCloud && user?.id ? `cloud:${user.id}` : isLocal ? "local" : "none";
    loadedIdentity.current = identity;
    setStorageReady(false);
    setSync(isCloud ? "Conectando" : "Cargando local");

    (async () => {
      if (isLocal) {
        const migrated = await migrateLegacyLocalState().catch(() => null);
        const local = migrated || await getLocalState().catch(() => null);
        if (!active || loadedIdentity.current !== identity) return;
        setData(normalizeData(local || seed));
        setSync("Solo en este dispositivo");
        setStorageReady(true);
        return;
      }

      if (isCloud && user?.id) {
        const cached = await getCloudState(user.id).catch(() => null);
        if (cached && active && loadedIdentity.current === identity) setData(normalizeData(cached));

        try {
          const { data: row, error } = await supabase
            .from("gf_user_state")
            .select("data")
            .eq("user_id", user.id)
            .maybeSingle();
          if (error) throw error;
          const next = normalizeData(row?.data || seed);
          if (!row) {
            const { error: createError } = await supabase
              .from("gf_user_state")
              .upsert({ user_id: user.id, data: next }, { onConflict: "user_id" });
            if (createError) throw createError;
          }
          await setCloudState(user.id, next).catch(() => undefined);
          if (!active || loadedIdentity.current !== identity) return;
          setData(next);
          setSync("Sincronizado");
        } catch {
          if (!active || loadedIdentity.current !== identity) return;
          setData(normalizeData(cached || seed));
          setSync(cached ? "Sin conexión · caché" : "Sin conexión");
        }
        setStorageReady(true);
        return;
      }

      if (active) {
        setData(seed);
        setSync("Sin sesión");
        setStorageReady(true);
      }
    })();

    return () => { active = false; };
  }, [isCloud, isLocal, user?.id]);

  useEffect(() => {
    if (!storageReady) return undefined;

    if (isLocal) {
      const timer = setTimeout(() => {
        setLocalState(data).then(() => setSync("Solo en este dispositivo")).catch(() => setSync("Error local"));
      }, 120);
      return () => clearTimeout(timer);
    }

    if (isCloud && user?.id) {
      setCloudState(user.id, data).catch(() => undefined);
      setSync("Guardando…");
      const timer = setTimeout(async () => {
        const { error } = await supabase
          .from("gf_user_state")
          .upsert({ user_id: user.id, data }, { onConflict: "user_id" });
        setSync(error ? "Pendiente" : "Sincronizado");
      }, 500);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [data, storageReady, isCloud, isLocal, user?.id]);

  const reminderSignature = data.people
    .filter((person) => person.role === "Cliente")
    .map((person) => `${person.id}|${person.name}|${person.expiry || ""}|${person.branch || ""}`)
    .sort()
    .join(";");

  useEffect(() => {
    if (!isCloud || !storageReady) return undefined;
    const timer = setTimeout(() => {
      data.people.filter((person) => person.role === "Cliente" && person.expiry).forEach((person) => {
        scheduleMembershipNotifications(person).catch(() => undefined);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [reminderSignature, isCloud, storageReady]);

  const update = (fn) => setData((current) => fn(structuredClone(current)));
  const sendNotification = (type, title, body, branch = data.activeBranch, url = "/") => {
    update((d) => {
      d.notificationLog = [{ id: crypto.randomUUID(), type, title, body, branch, date: new Date().toISOString() }, ...(d.notificationLog || [])].slice(0, 100);
      return d;
    });
    if (isCloud) sendRemoteEvent({ type, title, body, branch, url }).catch(() => showDeviceNotification(title, body));
    else showDeviceNotification(title, body);
  };
  const publishAccess = (result) => {
    const displayEvent = { ...result, person: result.person ? { id: result.person.id, name: result.person.name, dni: result.person.dni, role: result.person.role, plan: result.person.plan, expiry: result.person.expiry } : null };
    localStorage.setItem("gymflow-access-display", JSON.stringify(displayEvent));
    try {
      const channel = new BroadcastChannel("gymflow-access");
      channel.postMessage({ type: "access-result", payload: displayEvent });
      channel.close();
    } catch { /* localStorage mantiene la compatibilidad */ }
  };
  const actions = {
    setBranch: (activeBranch) => update((d) => ({ ...d, activeBranch })),
    setNotificationPreference: (type, enabled) => update((d) => ({ ...d, notificationPreferences: { ...d.notificationPreferences, [type]: enabled } })),
    addPerson: (person) => {
      const duplicate = data.people.find((item) => item.dni === person.dni);
      if (duplicate) return { ok: false, error: `El DNI ${person.dni} ya pertenece a ${duplicate.name}.` };
      const branch = person.branch || data.activeBranch;
      const id = crypto.randomUUID();
      const { initialPayment, discount = 0, method = "Efectivo", ...personData } = person;
      update((d) => {
        d.people.unshift({ ...personData, id, branch, start: person.start || iso(), expiry: person.role === "Profesor" ? "" : person.expiry });
        if (person.role === "Cliente" && initialPayment) {
          const amount = Math.round(Number(person.price) * (1 - Number(discount || 0) / 100));
          d.transactions.unshift({ id: crypto.randomUUID(), personId: id, branch, type: "income", category: "Membresía", detail: `Alta · ${person.name} (${discount || 0}% desc.)`, amount, method, date: person.start || iso() });
        }
        return d;
      });
      if (person.role === "Cliente") {
        sendNotification("newClient", "Nuevo cliente", `${person.name} fue registrado en ${data.branches.find((item) => item.id === branch)?.name}.`, branch, "/clientes");
        if (isCloud) scheduleMembershipNotifications({ ...personData, id, branch, expiry: person.expiry }).catch(() => undefined);
      }
      if (person.role === "Cliente" && initialPayment) {
        const amount = Math.round(Number(person.price) * (1 - Number(discount || 0) / 100));
        sendNotification("income", "Ingreso registrado", `Alta de ${person.name}: $${amount.toLocaleString("es-AR")}.`, branch, "/caja");
      }
      return { ok: true, id };
    },
    editPerson: (id, changes) => {
      const duplicate = data.people.find((item) => item.dni === changes.dni && item.id !== id);
      if (duplicate) return { ok: false, error: `El DNI ${changes.dni} ya pertenece a ${duplicate.name}.` };
      update((d) => {
        const person = d.people.find((item) => item.id === id);
        if (person) Object.assign(person, changes);
        return d;
      });
      const current = data.people.find((item) => item.id === id);
      const nextPerson = current ? { ...current, ...changes } : null;
      if (isCloud && nextPerson?.role === "Cliente") scheduleMembershipNotifications(nextPerson).catch(() => undefined);
      return { ok: true };
    },
    deletePerson: (id) => {
      if (isCloud) cancelMembershipNotifications(id).catch(() => undefined);
      return update((d) => ({ ...d, people: d.people.filter((person) => person.id !== id) }));
    },
    renew: (id, { months, discount, method }) => {
      const currentPerson = data.people.find((person) => person.id === id); if (!currentPerson) return;
      const amount = Math.round(currentPerson.price * Number(months) * (1 - Number(discount || 0) / 100));
      const base = new Date(Math.max(Date.now(), new Date(`${currentPerson.expiry || iso()}T12:00:00`).getTime()));
      base.setMonth(base.getMonth() + Number(months));
      const nextExpiry = base.toISOString().slice(0, 10);
      update((d) => {
        const person = d.people.find((item) => item.id === id); if (!person) return d;
        person.expiry = nextExpiry;
        d.transactions.unshift({ id: crypto.randomUUID(), personId: person.id, branch: person.branch, type: "income", category: "Membresía", detail: `Renovación · ${person.name} (${discount || 0}% desc.)`, amount, method, date: iso() });
        return d;
      });
      sendNotification("income", "Ingreso registrado", `Renovación de ${currentPerson.name}: $${amount.toLocaleString("es-AR")}.`, currentPerson.branch, "/caja");
      if (isCloud) scheduleMembershipNotifications({ ...currentPerson, expiry: nextExpiry }).catch(() => undefined);
    },
    addTransaction: (transaction) => {
      const branch = transaction.branch || data.activeBranch; const amount = Number(transaction.amount);
      update((d) => ({ ...d, transactions: [{ ...transaction, id: crypto.randomUUID(), branch, amount, date: transaction.date || iso() }, ...d.transactions] }));
      const isWithdrawal = transaction.type === "expense" && transaction.category === "Retiro de caja";
      const type = transaction.type === "income" ? "income" : isWithdrawal ? "withdrawal" : "expense";
      const title = transaction.type === "income" ? "Ingreso registrado" : isWithdrawal ? "Retiro de caja" : "Gasto registrado";
      sendNotification(type, title, `${transaction.detail}: $${amount.toLocaleString("es-AR")}.`, branch, "/caja");
    },
    deleteTransaction: (id) => update((d) => ({ ...d, transactions: d.transactions.filter((transaction) => transaction.id !== id) })),
    closeCash: (actual) => update((d) => {
      const day = d.transactions.filter((t) => t.branch === d.activeBranch && t.date === iso());
      const expected = day.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
      d.closures.unshift({ id: crypto.randomUUID(), branch: d.activeBranch, date: new Date().toISOString(), expected, actual: Number(actual), difference: Number(actual) - expected }); return d;
    }),
    clearAccesses: () => update((d) => ({ ...d, accesses: d.accesses.filter((access) => access.branch !== d.activeBranch) })),
    clearNotificationLog: () => update((d) => ({ ...d, notificationLog: [] })),
    checkAccess: (query) => {
      const person = data.people.find((p) => p.dni === query || p.id === query);
      const membershipStatus = person ? statusOf(person) : "No encontrado";
      const usage = planUsage(person, data.accesses);
      const allowed = !!person && membershipStatus !== "Vencida" && !usage.limitReached;
      const denialReason = !person ? "DNI no registrado" : membershipStatus === "Vencida" ? "Membresía vencida" : usage.limitReached ? "Límite semanal de 3 días alcanzado" : null;
      const lastPayment = person?.role === "Profesor" ? null : data.transactions.find((t) =>
        t.type === "income" && t.category === "Membresía" &&
        (t.personId === person?.id || (!t.personId && t.detail?.includes(person?.name)))
      );
      const daysToExpiry = person?.expiry
        ? Math.ceil((new Date(`${person.expiry}T23:59:59`) - new Date()) / 86400000)
        : null;
      const result = {
        person,
        allowed,
        membershipStatus,
        lastPaymentDate: lastPayment?.date || person?.start || null,
        daysToExpiry,
        planUsage: usage,
        denialReason,
        branchName: data.branches.find((b) => b.id === (person?.branch || data.activeBranch))?.name,
        checkedAt: new Date().toISOString(),
      };
      publishAccess(result);
      update((d) => { d.accesses.unshift({ id: crypto.randomUUID(), personId: person?.id || null, branch: d.activeBranch, allowed, date: new Date().toISOString() }); return d; });
      if (!allowed) sendNotification("deniedAccess", "Ingreso rechazado", person ? `${person.name}: ${denialReason}.` : `DNI ${query} no registrado.`, data.activeBranch, "/accesos");
      else if (person.role === "Profesor") sendNotification("staffAccess", "Ingreso de profesor", `${person.name} ingresó al gimnasio.`, person.branch, "/accesos");
      else sendNotification("clientAccess", "Ingreso de cliente", `${person.name} ingresó al gimnasio.`, person.branch, "/accesos");
      return result;
    },
    allowGuest: () => {
      const branchName = data.branches.find((branch) => branch.id === data.activeBranch)?.name;
      const result = {
        person: { id: "manual", name: "Acceso autorizado", dni: "—", role: "Invitado", plan: "Permiso manual", expiry: "" },
        allowed: true,
        manual: true,
        membershipStatus: "Autorizado por recepción",
        lastPaymentDate: null,
        daysToExpiry: null,
        branchName,
        checkedAt: new Date().toISOString(),
      };
      publishAccess(result);
      update((d) => { d.accesses.unshift({ id: crypto.randomUUID(), personId: null, branch: d.activeBranch, allowed: true, manual: true, date: new Date().toISOString() }); return d; });
      sendNotification("manualAccess", "Acceso manual autorizado", `Recepción permitió un ingreso sin registro en ${branchName}.`, data.activeBranch, "/accesos");
      return result;
    },
  };

  return <GymContext.Provider value={{ data, sync, ...actions }}>{children}</GymContext.Provider>;
}

export const useGym = () => useContext(GymContext);
