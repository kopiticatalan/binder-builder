#!/usr/bin/env node
/**
 * Assemble Binder Builder.app (WKWebView + Python stdlib server + static SPA)
 * and zip it into public/Binder-Builder-for-Mac.zip.
 */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(root, "macos", ".stage");
const appName = "Binder Builder.app";
const appRoot = join(staging, appName);
const contents = join(appRoot, "Contents");
const macos = join(contents, "MacOS");
const resources = join(contents, "Resources");
const web = join(resources, "web");
const zipName = "Binder-Builder-for-Mac.zip";
const zipOut = join(root, "public", zipName);

if (!process.env.SKIP_DESKTOP_BUILD) {
  const built = spawnSync("npm", ["run", "build:desktop"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (built.status !== 0) {
    console.error("[pack-mac] desktop SPA build failed");
    process.exit(built.status || 1);
  }
}

const distClient = join(root, "dist", "client");
if (!existsSync(join(distClient, "index.html"))) {
  console.error("[pack-mac] missing dist/client/index.html — run npm run build:desktop");
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(macos, { recursive: true });
mkdirSync(resources, { recursive: true });
mkdirSync(web, { recursive: true });

copyFileSync(join(root, "macos", "Info.plist"), join(contents, "Info.plist"));
copyFileSync(join(root, "macos", "run"), join(macos, "run"));
chmodSync(join(macos, "run"), 0o755);
copyFileSync(join(root, "macos", "How to open.txt"), join(staging, "How to open.txt"));

for (const name of ["server.py", "court.py", "forums.py"]) {
  const src = join(root, "macos", name);
  if (!existsSync(src)) {
    console.error(`[pack-mac] missing ${name}`);
    process.exit(1);
  }
  copyFileSync(src, join(resources, name));
}

const webkitCandidates = [
  join(root, "macos", "webkit-window"),
  "/tmp/mt-app/Matter Tracker.app/Contents/MacOS/webkit-window",
];
const webkit = webkitCandidates.find((p) => existsSync(p));
if (!webkit) {
  console.error("[pack-mac] missing webkit-window binary");
  process.exit(1);
}
copyFileSync(webkit, join(macos, "webkit-window"));
chmodSync(join(macos, "webkit-window"), 0o755);

const icnsCandidates = [
  join(root, "macos", "AppIcon.icns"),
  "/tmp/mt-app/Matter Tracker.app/Contents/Resources/AppIcon.icns",
];
const icns = icnsCandidates.find((p) => existsSync(p));
if (icns) copyFileSync(icns, join(resources, "AppIcon.icns"));

function copyWeb(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === zipName) continue;
    const src = join(from, name);
    const dest = join(to, name);
    if (statSync(src).isDirectory()) cpSync(src, dest, { recursive: true });
    else copyFileSync(src, dest);
  }
}
copyWeb(distClient, web);
rmSync(join(web, zipName), { force: true });

mkdirSync(join(root, "public"), { recursive: true });
rmSync(zipOut, { force: true });
const py = `
import os, zipfile, stat
from pathlib import Path
root = Path(${JSON.stringify(staging)})
out = Path(${JSON.stringify(zipOut)})
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for p in root.rglob("*"):
        if p.is_dir():
            continue
        rel = p.relative_to(root).as_posix()
        mode = p.stat().st_mode
        info = zipfile.ZipInfo(rel)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = stat.S_IFREG << 16
        if stat.S_IMODE(mode) & 0o111:
            info.external_attr = (0o755 | stat.S_IFREG) << 16
        else:
            info.external_attr = (0o644 | stat.S_IFREG) << 16
        zf.writestr(info, p.read_bytes())
print(out, out.stat().st_size)
`;
const zipped = spawnSync("python3", ["-c", py], { stdio: "inherit" });
if (zipped.status !== 0) {
  console.error("[pack-mac] zip failed");
  process.exit(zipped.status || 1);
}

const kb = Math.round(statSync(zipOut).size / 1024);
console.log(`[pack-mac] ${zipOut} (${kb} KB)`);
