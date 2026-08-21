import { letterLabel, roman } from "@/lib/utils";
import type { BinderDoc, Column, ExhibitScheme, PaperKind } from "./types";
import { isCaseValue } from "./types";

export function guessFields(doc: BinderDoc, columns: Column[]) {
  const caseCol = columns.find((c) => c.type === "case");
  if (caseCol) {
    let base = doc.filename.replace(/\.pdf$/i, "").replace(/^\[[^\]]*\]\s*/, "").trim();
    const m = base.match(/^(.*?v(?:s\.?|ersus)?\s+\S.*?),\s*(.+)$/i);
    doc.fields[caseCol.id] = m
      ? { name: m[1].trim(), cite: m[2].trim() }
      : { name: base, cite: "" };
  }
  const dateCol = columns.find((c) => c.type === "date");
  if (dateCol) {
    const dm = doc.filename.match(/(\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})|(20\d{2}|19\d{2})/);
    if (dm) doc.fields[dateCol.id] = dm[1] || dm[2] || "";
  }
}

export function guessKind(doc: BinderDoc): PaperKind {
  if (doc.exhibit) return "exhibit";
  const blob = `${doc.filename} ${doc.bookmark}`.toLowerCase();
  if (/affidavit|\bao[as]\b|written statement/.test(blob)) return "affidavit";
  if (/\border\b|award|judgement|judgment|decree/.test(blob)) return "order";
  if (/letter|email|correspondence|notice/.test(blob)) return "correspondence";
  if (/plaint|petition|appeal|reply|rejoinder|\bia\b|application/.test(blob)) return "pleading";
  if (/v\.|vs\.|versus/.test(blob)) return "authority";
  const hasCase = Object.values(doc.fields).some((v) => isCaseValue(v) && v.name.trim());
  if (hasCase) return "authority";
  return "other";
}

export function autoBookmark(doc: BinderDoc, columns: Column[]) {
  const caseCol = columns.find((c) => c.type === "case");
  const paraCol = columns.find((c) => c.type === "text" && /para/i.test(c.name));
  let t = "";
  const caseVal = caseCol ? doc.fields[caseCol.id] : undefined;
  if (isCaseValue(caseVal)) {
    t = (caseVal.name || "") + (caseVal.cite ? ", " + caseVal.cite : "");
  } else {
    const textCol = columns.find((c) => c.type === "text");
    if (textCol && typeof doc.fields[textCol.id] === "string") {
      t = doc.fields[textCol.id] as string;
    } else t = doc.filename.replace(/\.pdf$/i, "");
  }
  if (paraCol && typeof doc.fields[paraCol.id] === "string" && doc.fields[paraCol.id]) {
    t += " — " + doc.fields[paraCol.id];
  }
  if (doc.flagged) t = "★ " + t;
  return t;
}

export function exhibitLabel(index: number, scheme: ExhibitScheme): string {
  if (scheme === "letters") return letterLabel(index);
  if (scheme === "arabic") return String(index + 1);
  if (scheme === "roman") return roman(index + 1);
  if (scheme === "annexure") return "ANNEXURE " + letterLabel(index);
  return "";
}

export function applyExhibitScheme(docs: BinderDoc[], scheme: ExhibitScheme) {
  if (scheme === "none") return;
  docs.forEach((d, i) => {
    d.exhibit = exhibitLabel(i, scheme);
  });
}
