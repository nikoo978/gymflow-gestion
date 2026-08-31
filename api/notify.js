import { requireNotificationSecret } from "./_auth.js";
import { sendPush } from "./_push.js";
import { redis, reminderKey, sentKey } from "./_redis.js";
import { continueRelay } from "./_qstash.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    requireNotificationSecret(req);
    const payload = req.body || {};

    if (payload.kind === "relay") {
      await continueRelay(payload.finalAt, payload.payload);
      return res.status(200).json({ ok: true, relayed: true });
    }

    if (payload.kind !== "membership" || !payload.userId || !payload.personId || !payload.version || !payload.type) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    const stateRaw = await redis(["GET", reminderKey(payload.userId, payload.personId)]);
    if (!stateRaw) return res.status(200).json({ ok: true, ignored: "cancelled" });

    let state;
    try { state = typeof stateRaw === "string" ? JSON.parse(stateRaw) : stateRaw; } catch {
      return res.status(200).json({ ok: true, ignored: "invalid-state" });
    }

    if (state.userId !== payload.userId || state.version !== payload.version) {
      return res.status(200).json({ ok: true, ignored: "stale-version" });
    }

    const dedupeId = `${payload.personId}:${payload.version}:${payload.type}:${payload.finalAt || "once"}`;
    const doneKey = sentKey(payload.userId, dedupeId);
    const alreadyDone = await redis(["GET", doneKey]);
    if (alreadyDone === "sent") return res.status(200).json({ ok: true, duplicate: true });

    const result = await sendPush({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url || "/clientes",
      tag: `${payload.type}-${payload.personId}`,
      data: { personId: payload.personId, branch: payload.branch || null },
      dedupeId,
    });

    // Los locks por dispositivo impiden duplicar los envíos que ya salieron.
    // Si alguno falla de forma transitoria devolvemos 503 para que QStash reintente
    // solamente los dispositivos pendientes.
    if (result.failed > 0) {
      return res.status(503).json({ error: "Uno o más envíos Push fallaron temporalmente.", ...result });
    }

    await redis(["SET", doneKey, "sent", "EX", 60 * 60 * 24 * 45]);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("notify-api", error);
    return res.status(error.statusCode || 500).json({ error: error.message || "Error interno" });
  }
}
