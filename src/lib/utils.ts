import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId() {
  return crypto.randomUUID();
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function fileSafe(s: string) {
  return (s || "Binder").replace(/[/\\:*?"<>|]/g, "-").slice(0, 120);
}

export function titleCase(s: string) {
  return s === s.toUpperCase()
    ? s
        .split(/\s+/)
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ")
    : s;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

export function downloadBuffer(filename: string, data: ArrayBuffer, mime: string) {
  downloadBlob(new Blob([data], { type: mime }), filename);
}

export function roman(n: number, lower = false) {
  if (n <= 0) return "0";
  const pairs: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let x = n;
  for (const [v, s] of pairs) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return lower ? out.toLowerCase() : out;
}

export function letterLabel(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const n = Math.max(1, limit);
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export function publicUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const p = String(path || "").replace(/^\//, "");
  return `${base}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

export function short(s: string | undefined | null, n = 55) {
  const t = (s ?? "").trim();
  return t.length > n ? t.slice(0, n).trim() : t;
}

export function forumOf(m: { forum?: string }) {
  if (m.forum === "sat") return "sat" as const;
  if (m.forum === "nclt") return "nclt" as const;
  if (m.forum === "bhc") return "bhc" as const;
  if (m.forum === "arb") return "arb" as const;
  return "" as const;
}

export function caseLabel(m: {
  forum?: string;
  typeName?: string;
  caseNo?: string;
  year?: string;
  stampreg?: string;
  lodging?: string;
  benchLabel?: string;
  institution?: string;
  config?: { caseNumber?: string };
}) {
  const stored = m.config?.caseNumber?.trim();
  if (!m.forum) return stored || "";
  if (forumOf(m) === "nclt") {
    return m.lodging || `${(m.typeName || "NCLT").split(" (")[0]} ${m.caseNo}/${m.year}`;
  }
  if (forumOf(m) === "arb") {
    return stored || [m.institution, m.caseNo, m.year].filter(Boolean).join(" ") || "";
  }
  const no = m.caseNo || "—";
  const yr = m.year || "—";
  if (forumOf(m) === "sat") {
    const kind = (m.typeName || "SEBI").split(" - ")[0].trim() || "SEBI";
    return `${kind} ${no}/${yr}`;
  }
  const abbr = (m.typeName || "").split(" - ")[0].trim() || "Case";
  if (m.stampreg === "S") return `${abbr}(L)/${no}/${yr}`;
  return `${abbr}/${no}/${yr}`;
}

export function matterCasenos(m: {
  forum?: string;
  typeName?: string;
  caseNo?: string;
  year?: string;
  stampreg?: string;
  cnr?: string;
  lodging?: string;
  config?: { caseNumber?: string };
}) {
  const out = [caseLabel(m).toUpperCase()].filter(Boolean);
  if (m.cnr) out.push(m.cnr.toUpperCase());
  if (forumOf(m) === "sat") {
    const no = (m.caseNo || "").replace(/\D/g, "");
    const yr = m.year || "";
    const kind = (m.typeName || "SEBI").split(" - ")[0].trim().toUpperCase();
    const padded = no.length >= 4 ? no : no.padStart(4, "0");
    if (padded && yr) {
      out.push(`${kind}/${padded}/${yr}`);
      out.push(`${padded}/${yr}`);
      out.push(`APPEAL - ${padded}/${yr}`);
    }
    if (m.lodging) out.push(String(m.lodging).toUpperCase());
  }
  if (forumOf(m) === "nclt") {
    const no = (m.caseNo || "").replace(/\D/g, "");
    const yr = m.year || "";
    if (m.lodging) out.push(String(m.lodging).toUpperCase());
    if (no && yr) {
      out.push(`${no}/${yr}`);
      out.push(`${no}(MB)${yr}`);
      out.push(`${no}/MB/${yr}`);
    }
  }
  return out;
}

export function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function canFetchCourt(m: {
  forum?: string;
  caseType?: string;
  caseNo?: string;
  year?: string;
  side?: string;
  stampreg?: string;
}) {
  if (!m.caseType || !m.caseNo || !m.year) return false;
  if (m.forum === "sat" || m.forum === "nclt") return true;
  if (m.forum === "bhc") return Boolean(m.side && m.stampreg);
  return false;
}

export function forumCourtName(m: { forum?: string; benchLabel?: string; sideLabel?: string }) {
  if (m.forum === "sat") return "Securities Appellate Tribunal";
  if (m.forum === "nclt") return `NCLT ${m.benchLabel || "Mumbai"}`;
  if (m.forum === "bhc") return "High Court of Bombay";
  return m.sideLabel || "";
}
