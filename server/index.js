import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = resolve(ROOT, process.env.STATIC_DIR || "dist");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);

const API_ROUTES = new Map([
  ["/api/health", "api/health.js"],
  ["/api/push", "api/push.js"],
  ["/api/notify", "api/notify.js"],
  ["/api/reminders", "api/reminders.js"],
  ["/api/events", "api/events.js"],
  ["/api/account-events", "api/account-events.js"],
]);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function queryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams) {
    if (query[key] === undefined) query[key] = value;
    else if (Array.isArray(query[key])) query[key].push(value);
    else query[key] = [query[key], value];
  }
  return query;
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Payload demasiado grande");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseBody(rawBody, contentType) {
  if (!rawBody.length) return undefined;
  const type = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  if (type === "application/json" || type.endsWith("+json")) {
    try {
      return JSON.parse(rawBody.toString("utf8"));
    } catch {
      const error = new Error("JSON inválido");
      error.statusCode = 400;
      throw error;
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")));
  }
  return rawBody;
}

function adaptResponse(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (value) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value));
    return res;
  };
  return res;
}

async function handleApi(req, res, url) {
  const modulePath = API_ROUTES.get(url.pathname);
  if (!modulePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "API no encontrada" }));
    return;
  }

  try {
    req.query = queryObject(url.searchParams);
    req.rawBody = await readRawBody(req);
    req.body = parseBody(req.rawBody, req.headers["content-type"]);
    const module = await import(pathToFileURL(resolve(ROOT, modulePath)).href);
    if (typeof module.default !== "function") throw new Error(`Handler inválido: ${modulePath}`);
    await module.default(req, adaptResponse(res));
  } catch (error) {
    console.error("api-adapter", url.pathname, error);
    if (res.writableEnded) return;
    res.statusCode = error?.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error?.message || "Error interno" }));
  }
}

function safeStaticPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  const candidate = resolve(DIST_DIR, relative);
  return candidate === DIST_DIR || candidate.startsWith(`${DIST_DIR}/`) ? candidate : null;
}

function cacheControl(pathname) {
  if (pathname === "/sw.js" || pathname === "/manifest.webmanifest" || pathname === "/index.html") return "no-cache";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

function sendFile(req, res, filePath, pathname) {
  const stat = statSync(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Cache-Control", cacheControl(pathname));
  if (req.method === "HEAD") return res.end();
  createReadStream(filePath).pipe(res);
}

async function handleStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  const requested = safeStaticPath(url.pathname);
  if (requested && existsSync(requested) && statSync(requested).isFile()) {
    sendFile(req, res, requested, url.pathname);
    return;
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Frontend build not found. Run npm run build.");
    return;
  }

  sendFile(req, res, indexPath, "/index.html");
}

export function createAppServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await handleStatic(req, res, url);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(PORT, HOST, () => console.log(`GymFlow listening on http://${HOST}:${PORT}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close((error) => {
      if (error) {
        console.error("shutdown", error);
        process.exitCode = 1;
      }
      process.exit();
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
