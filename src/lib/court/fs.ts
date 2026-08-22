import { hasLocalCourtApi } from "./local";

export type DeskFs = {
  ok: boolean;
  fs: boolean;
  home: string;
  desktop: string;
  defaultRoot: string;
  version?: string;
};

let cached: DeskFs | null = null;

function isJson(r: Response) {
  return (r.headers.get("content-type") || "").includes("json");
}

export async function deskFs(): Promise<DeskFs> {
  if (cached?.fs) return cached;
  const empty: DeskFs = { ok: false, fs: false, home: "", desktop: "", defaultRoot: "" };
  if (!(await hasLocalCourtApi())) {
    cached = empty;
    return cached;
  }
  try {
    const r = await fetch("/api/health");
    if (!r.ok || !isJson(r)) return empty;
    const j = (await r.json()) as Partial<DeskFs> & { ok?: boolean };
    const next: DeskFs = {
      ok: Boolean(j.ok),
      fs: Boolean(j.fs),
      home: j.home || "",
      desktop: j.desktop || "",
      defaultRoot: j.defaultRoot || "",
      version: j.version,
    };
    if (next.fs) cached = next;
    return next;
  } catch {
    return empty;
  }
}

async function fsPost<T>(op: string, data: unknown): Promise<T | null> {
  if (!(await hasLocalCourtApi())) return null;
  try {
    const r = await fetch(`/api/fs/${op}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });
    if (!isJson(r)) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function chooseFolder(prompt: string) {
  return fsPost<{ ok: boolean; path?: string; error?: string }>("choose-folder", { prompt });
}

export async function savePdfToFolder(
  folder: string,
  filename: string,
  base64: string,
  opts?: { overwrite?: boolean },
) {
  return fsPost<{ ok: boolean; path?: string; existed?: boolean; error?: string }>("save-pdf", {
    folder,
    filename,
    base64,
    overwrite: Boolean(opts?.overwrite),
  });
}

export async function openFolder(path: string) {
  return fsPost<{ ok: boolean; error?: string }>("open-folder", { path });
}

export async function openExternal(url: string) {
  const r = await fsPost<{ ok: boolean; error?: string }>("open-url", { url });
  if (r?.ok) return r;
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true as const };
}

export function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
