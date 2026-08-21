import { isCaseValue, type BinderDoc, type Column, type Matter } from "./types";

export type ToaBucket =
  | "Supreme Court of India"
  | "High Courts"
  | "NCLT / NCLAT"
  | "Other tribunals"
  | "Foreign / other";

export const TOA_ORDER: ToaBucket[] = [
  "Supreme Court of India",
  "High Courts",
  "NCLT / NCLAT",
  "Other tribunals",
  "Foreign / other",
];

export interface ToaRow {
  name: string;
  cite: string;
  paras: string;
  bucket: ToaBucket;
  flagged: boolean;
  docId: string;
}

export function classifyAuthority(name: string, cite: string): ToaBucket {
  const s = `${name} ${cite}`.toLowerCase();
  if (/\bnclat\b|\bnclt\b|company appeal \(at\)/.test(s)) return "NCLT / NCLAT";
  if (/\bscc\b|\bscr\b|\bscale\b|supreme court|\bair sc\b/.test(s)) return "Supreme Court of India";
  if (/\bitat\b|\bcestat\b|\bdrat\b|\bdrt\b|\bncdrc\b|\bscdrcc\b|\bappt\b|tribunal/.test(s)) return "Other tribunals";
  if (
    /\bhc\b|high court|\bcal\b|\bbom\b|\bdel\b|\bmad\b|\bkar\b|\bguj\b|\ball\b|\bp&h\b|\bker\b|\bap\b|\btel\b|\bhp\b|\buk\b|\braj\b|\bmp\b|\bchh\b|\bjhark\b|\borissa\b|\bpat\b|\bgau\b|\bmanipur\b|\bmegh\b|\btrip\b|\bsikkim\b|\budaipur\b/.test(
      s,
    )
  ) {
    return "High Courts";
  }
  if (/\bus\b|\bewca\b|\bwlr\b|\ball er\b|\bf\.?3d\b|\bf\.?supp/.test(s)) return "Foreign / other";
  return "Foreign / other";
}

export function tableOfAuthorities(matter: Matter): Record<ToaBucket, ToaRow[]> {
  const caseCol = matter.columns.find((c) => c.type === "case");
  const paraCol = matter.columns.find((c) => c.type === "text" && /para|proposition|pin/i.test(c.name));
  const out: Record<ToaBucket, ToaRow[]> = {
    "Supreme Court of India": [],
    "High Courts": [],
    "NCLT / NCLAT": [],
    "Other tribunals": [],
    "Foreign / other": [],
  };
  if (!caseCol) return out;
  for (const d of matter.docs) {
    const v = d.fields[caseCol.id];
    if (!isCaseValue(v) || !v.name.trim()) continue;
    const paras = paraCol && typeof d.fields[paraCol.id] === "string" ? (d.fields[paraCol.id] as string) : "";
    const bucket = classifyAuthority(v.name, v.cite);
    out[bucket].push({
      name: v.name.trim(),
      cite: v.cite.trim(),
      paras,
      bucket,
      flagged: d.flagged,
      docId: d.id,
    });
  }
  for (const k of TOA_ORDER) {
    out[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

export function docDateValue(doc: BinderDoc, columns: Column[]): string {
  const dateCol = columns.find((c) => c.type === "date");
  if (!dateCol) return "";
  const v = doc.fields[dateCol.id];
  return typeof v === "string" ? v : "";
}

export function paperTitle(doc: BinderDoc, columns: Column[]): string {
  const caseCol = columns.find((c) => c.type === "case");
  if (caseCol) {
    const v = doc.fields[caseCol.id];
    if (isCaseValue(v) && v.name.trim()) {
      return v.cite ? `${v.name}, ${v.cite}` : v.name;
    }
  }
  const textCol = columns.find((c) => c.type === "text");
  if (textCol && typeof doc.fields[textCol.id] === "string" && (doc.fields[textCol.id] as string).trim()) {
    return doc.fields[textCol.id] as string;
  }
  return doc.filename.replace(/\.pdf$/i, "");
}
