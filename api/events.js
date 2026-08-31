import { requireAdmin } from "./_auth.js";
import { sendPush } from "./_push.js";

const ALLOWED_TYPES = new Set(["newClient", "income", "withdrawal", "expense", "clientAccess", "staffAccess", "deniedAccess", "manualAccess"]);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    const admin = await requireAdmin(req);
    const { type, title, body, branch, url = "/" } = req.body || {};
    if (!ALLOWED_TYPES.has(type) || !title || !body) return res.status(400).json({ error: "Evento inválido" });
    const result = await sendPush({ userId: admin.uid, type, title: String(title).slice(0, 100), body: String(body).slice(0, 240), url, tag: `${type}-${branch || "all"}`, data: { branch: branch || null } });
    if (!result.sent && result.failed) return res.status(502).json({ error: "El servicio Push rechazó el envío.", ...result });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("events-api", error);
    return res.status(error.statusCode || 500).json({ error: error.message || "Error interno" });
  }
}
