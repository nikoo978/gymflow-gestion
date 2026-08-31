import { requireAdmin } from "./_auth.js";
import { hashValue, redis, reminderKey } from "./_redis.js";
import { publishAt } from "./_qstash.js";

const HOUR_AR_OFFSET = "-03:00";
const atNine = (date) => Date.parse(`${date}T09:00:00${HOUR_AR_OFFSET}`);
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    const admin = await requireAdmin(req);
    const { action = "schedule", person } = req.body || {};
    if (!person?.id) return res.status(400).json({ error: "Cliente inválido" });
    const key = reminderKey(admin.uid, person.id);

    if (action === "cancel" || !person.expiry) {
      await redis(["DEL", key]);
      return res.status(200).json({ ok: true, cancelled: true });
    }

    const version = hashValue(`${admin.uid}|${person.id}|${person.name || ""}|${person.expiry}|${person.branch || ""}`);
    const existingRaw = await redis(["GET", key]);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing.version === version && existing.scheduled) return res.status(200).json({ ok: true, unchanged: true, version });
      } catch { /* reschedule */ }
    }

    const state = { userId: admin.uid, personId: person.id, version, expiry: person.expiry, name: person.name || "Cliente", branch: person.branch || null, scheduled: false, updatedAt: new Date().toISOString() };
    await redis(["SET", key, JSON.stringify(state)]);

    const expiringAt = atNine(addDays(person.expiry, -1));
    const expiredAt = atNine(addDays(person.expiry, 1));
    const base = { kind: "membership", userId: admin.uid, personId: person.id, version, branch: person.branch || null, url: "/clientes" };
    const scheduled = [];
    if (expiringAt > Date.now() + 5000) scheduled.push(await publishAt({ ...base, type: "membershipExpiring", title: "Membresía por vencer", body: `${state.name} vence mañana (${person.expiry}).`, finalAt: expiringAt }, expiringAt));
    if (expiredAt > Date.now() + 5000) scheduled.push(await publishAt({ ...base, type: "membershipExpired", title: "Membresía vencida", body: `El período de ${state.name} venció el ${person.expiry}.`, finalAt: expiredAt }, expiredAt));
    state.scheduled = true;
    state.updatedAt = new Date().toISOString();
    await redis(["SET", key, JSON.stringify(state)]);
    return res.status(200).json({ ok: true, version, scheduled: scheduled.length });
  } catch (error) {
    console.error("reminders-api", error);
    return res.status(error.statusCode || 500).json({ error: error.message || "Error interno" });
  }
}
