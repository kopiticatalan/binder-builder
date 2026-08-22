import { Buffer } from "node:buffer";
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export function fsInfo() {
  const home = homedir();
  const desktop = join(home, "Desktop");
  return {
    ok: true as const,
    fs: true as const,
    version: "1.1.2",
    home,
    desktop,
    defaultRoot: join(desktop, "Bombay HC matters"),
  };
}

function expandPath(p: string) {
  const raw = (p || "").trim();
  if (!raw) throw new Error("Missing folder.");
  if (raw.startsWith("~/")) return resolve(join(homedir(), raw.slice(2)));
  if (raw === "~") return resolve(homedir());
  return resolve(raw);
}

function underHome(p: string) {
  const home = resolve(homedir());
  const real = resolve(p);
  if (real !== home && !real.startsWith(home + sep)) {
    throw new Error("Folder must be inside your home directory.");
  }
  return real;
}

export async function dispatchFs(op: string, data: Record<string, unknown>) {
  if (op === "choose-folder") {
    return { ok: true as const, path: fsInfo().defaultRoot };
  }
  if (op === "open-folder") {
    return { ok: true as const };
  }
  if (op === "save-pdf") {
    const folder = underHome(expandPath(String(data.folder || "")));
    const filename = String(data.filename || "order.pdf").replace(/[\\/]/g, "");
    const b64 = String(data.base64 || "");
    if (!b64) return { ok: false as const, error: "Missing PDF." };
    await mkdir(folder, { recursive: true });
    const dest = join(folder, filename);
    try {
      await access(dest, constants.F_OK);
      return { ok: true as const, path: dest, existed: true };
    } catch {
      /* new file */
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.subarray(0, 5).toString("utf8") !== "%PDF-") {
      return { ok: false as const, error: "That file is not a PDF." };
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return { ok: true as const, path: dest, existed: false };
  }
  return { ok: false as const, error: `Unknown file action: ${op}` };
}
