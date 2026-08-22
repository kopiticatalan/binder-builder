#!/usr/bin/env node
/**
 * GitHub Pages has no SPA rewrite. Copy the Start shell to index.html and
 * 404.html so /binder-builder/hearing still boots the app.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [join(root, "dist", "client"), join(root, ".output", "public")];
const pub = dirs.find((dir) => existsSync(dir));
if (!pub) {
  console.error("[pages-fallback] no dist/client or .output/public");
  process.exit(1);
}

const candidates = ["_shell.html", "index.html", "404.html"];
const source = candidates.map((name) => join(pub, name)).find((p) => existsSync(p));
if (!source) {
  console.error(`[pages-fallback] no HTML shell in ${pub}`);
  process.exit(1);
}

function stripNul(file) {
  if (!existsSync(file)) return;
  const buf = readFileSync(file);
  if (!buf.includes(0)) return;
  writeFileSync(file, Buffer.from(buf.filter((b) => b !== 0)));
}

const dest404 = join(pub, "404.html");
if (source !== dest404) copyFileSync(source, dest404);

const destIndex = join(pub, "index.html");
if (source !== destIndex) copyFileSync(source, destIndex);

for (const name of readdirSync(pub)) {
  if (name.endsWith(".html")) stripNul(join(pub, name));
}

writeFileSync(join(pub, ".nojekyll"), "");
console.log(`[pages-fallback] ${source} → index.html + 404.html`);
