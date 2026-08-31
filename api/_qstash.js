const RELAY_MS = 6 * 24 * 60 * 60 * 1000;

function appUrl() {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  const production = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  const preview = String(process.env.VERCEL_URL || "").trim();
  const url = configured || (production ? `https://${production}` : preview ? `https://${preview}` : "");
  if (!url) throw Object.assign(new Error("PUBLIC_APP_URL no configurada"), { statusCode: 503 });
  return url.replace(/\/$/, "");
}

export async function publishAt(payload, finalAtMs) {
  const token = String(process.env.QSTASH_TOKEN || "").trim();
  const secret = String(process.env.NOTIFICATION_SECRET || "").trim();
  if (!token || !secret) throw Object.assign(new Error("QStash no configurado"), { statusCode: 503 });

  const now = Date.now();
  const finalAt = Number(finalAtMs);
  if (!Number.isFinite(finalAt)) throw Object.assign(new Error("Fecha de notificación inválida"), { statusCode: 400 });
  if (finalAt <= now + 5000) return { skipped: true, reason: "past" };

  const nextAt = Math.min(finalAt, now + RELAY_MS);
  const isRelay = nextAt < finalAt;
  const qstashPayload = isRelay ? { kind: "relay", finalAt, payload } : payload;
  const target = `${appUrl()}/api/notify`;

  const response = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(Math.floor(nextAt / 1000)),
      "Upstash-Retries": "3",
      "Upstash-Forward-Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify(qstashPayload),
  });

  if (!response.ok) throw new Error(`QStash ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function continueRelay(finalAt, payload) {
  return publishAt(payload, Number(finalAt));
}
