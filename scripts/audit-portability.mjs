import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git", ".next", ".sites-runtime", ".wrangler", "dist", "node_modules", "outputs", "vercel-dist", "work",
]);
const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".html", ".js", ".jsx", ".json", ".md", ".mjs", ".sh", ".ts", ".tsx", ".txt", ".webmanifest", ".yaml", ".yml",
]);
const SPECIAL_FILES = new Set(["Dockerfile", ".dockerignore", ".gitignore", ".npmrc"]);
const TERMS = ["VERCEL", "QSTASH", "UPSTASH", "VAPID", "SUPABASE", "PUBLIC_APP_URL"];

const processEnv = new Set();
const importMetaEnv = new Set();
const termFiles = new Map(TERMS.map((term) => [term, new Set()]));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile() || (!TEXT_EXTENSIONS.has(extname(entry.name)) && !SPECIAL_FILES.has(entry.name))) continue;

    let source;
    try { source = await readFile(fullPath, "utf8"); } catch { continue; }
    const file = relative(ROOT, fullPath).replaceAll("\\", "/");

    for (const match of source.matchAll(/process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g)) {
      processEnv.add(match[1] || match[2]);
    }
    for (const match of source.matchAll(/import\.meta\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g)) {
      importMetaEnv.add(match[1] || match[2]);
    }
    const upper = source.toUpperCase();
    for (const term of TERMS) if (upper.includes(term)) termFiles.get(term).add(file);
  }
}

await walk(ROOT);

console.log("=== GymFlow portability audit ===");
console.log("process.env names:", [...processEnv].sort().join(", ") || "(none)");
console.log("import.meta.env names:", [...importMetaEnv].sort().join(", ") || "(none)");
for (const term of TERMS) {
  const files = [...termFiles.get(term)].sort();
  console.log(`${term} files (${files.length}):`);
  for (const file of files) console.log(`  - ${file}`);
}
