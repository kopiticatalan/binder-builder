import { DEFAULT_ORDER_PATTERN, type TrackerSettings } from "@/lib/types";
import { caseLabel, short } from "@/lib/utils";
import type { Matter, OrderMeta } from "./types";

export { DEFAULT_ORDER_PATTERN };

export const NAME_PRESETS: { label: string; pattern: string }[] = [
  { label: "1 25082026 Petitioner v Respondent", pattern: "{seq} {date} {pet} v {resp}" },
  { label: "25082026 Petitioner v Respondent", pattern: "{date} {pet} v {resp}" },
  { label: "WP-3025-2024 25082026 Order", pattern: "{caseno} {date} {doc}" },
  { label: "1 25-08-2026 Order", pattern: "{seq} {date_dmy} {doc}" },
  { label: "01 Petitioner v Respondent 25082026", pattern: "{srl} {pet} v {resp} {date}" },
];

export function sanitizeFilePart(s: string, maxlen = 80) {
  return (s || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, maxlen)
    .trim();
}

export function captionFolderName(m: Pick<Matter, "petitioner" | "respondent">) {
  const pet = short(sanitizeFilePart(m.petitioner || "Petitioner"), 55);
  const resp = short(sanitizeFilePart(m.respondent || "Respondent"), 55);
  return sanitizeFilePart(`${pet} v ${resp}`, 120) || "Unknown Case";
}

export function resolvedOrderFolder(
  m: Matter,
  settings: TrackerSettings,
  defaultRoot: string,
) {
  const own = (m.orderFolder || "").trim();
  if (own) return own.replace(/\/+$/, "");
  const root = (settings.orderRoot || defaultRoot || "").trim().replace(/\/+$/, "");
  if (!root) return captionFolderName(m);
  return `${root}/${captionFolderName(m)}`;
}

export function resolvedNamePattern(m: Matter, settings: TrackerSettings) {
  return (m.orderNamePattern || settings.orderNamePattern || DEFAULT_ORDER_PATTERN).trim();
}

export function orderSeq(matter: Matter, key?: string) {
  const ordered = [...(matter.orders ?? [])].sort((a, b) => {
    const pa = (a.date || "").split("/").reverse().join("");
    const pb = (b.date || "").split("/").reverse().join("");
    return pa.localeCompare(pb);
  });
  const i = key ? ordered.findIndex((o) => o.key === key) : -1;
  return i >= 0 ? i + 1 : ordered.length + 1;
}

export function formatOrderFilename(opts: {
  pattern: string;
  seq: number;
  date: string;
  pet: string;
  resp: string;
  caseno: string;
  doc: string;
  srl: string;
  year: string;
}) {
  const digits = (opts.date || "").replace(/\D/g, "");
  const ddmmyyyy = digits.length >= 8 ? digits.slice(-8) : digits || "undated";
  const dateDmy = (opts.date || "").replace(/\//g, "-") || ddmmyyyy;
  const pet = short(sanitizeFilePart(opts.pet || "Petitioner"), 40);
  const resp = short(sanitizeFilePart(opts.resp || "Respondent"), 40);
  const tokens: Record<string, string> = {
    seq: String(opts.seq),
    date_dmy: dateDmy,
    date: ddmmyyyy,
    pet,
    resp,
    caseno: sanitizeFilePart(opts.caseno || "case", 60),
    doc: sanitizeFilePart(opts.doc || "Order", 40),
    srl: opts.srl || String(opts.seq).padStart(2, "0"),
    year: opts.year || "",
  };
  let name = opts.pattern || DEFAULT_ORDER_PATTERN;
  // Longer keys first so {date_dmy} is not eaten by {date}.
  for (const k of Object.keys(tokens).sort((a, b) => b.length - a.length)) {
    name = name.replace(new RegExp(`\\{${k}\\}`, "g"), tokens[k]);
  }
  name = sanitizeFilePart(name, 120) || "order";
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return name;
}

export function filenameForOrder(matter: Matter, order: OrderMeta, settings: TrackerSettings) {
  return formatOrderFilename({
    pattern: resolvedNamePattern(matter, settings),
    seq: orderSeq(matter, order.key),
    date: order.date,
    pet: matter.petitioner,
    resp: matter.respondent,
    caseno: caseLabel(matter) || matter.config.caseNumber,
    doc: order.doc || order.title || "Order",
    srl: order.srl || "",
    year: matter.year,
  });
}
