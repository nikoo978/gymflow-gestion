import assert from "node:assert/strict";
import test from "node:test";

import { createAppServer } from "../server/index.js";

async function withServer(run) {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("serves the branded Vite shell and SPA routes", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/", "/pantalla-acceso"]) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers: { accept: "text/html" } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      const html = await response.text();
      assert.match(html, /<title>Infytter Fitness - Gestión de Gimnasio<\/title>/i);
      assert.match(html, /<div id="root"><\/div>/i);
      assert.match(html, /\/assets\/.+\.js/i);
      assert.doesNotMatch(html, /codex-preview/i);
    }
  });
});

test("serves the portable health endpoint", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.deepEqual(await response.json(), { ok: true, service: "gymflow" });
  });
});
