import { DEFAULT_CONFIG } from "./templates";
import type { BinderDoc, Matter, PaperKind } from "./types";
import { blankDoc } from "./types";

function guessKind(doc: BinderDoc): PaperKind {
  if (doc.kind && doc.kind !== "other") return doc.kind;
  if (doc.exhibit) return "exhibit";
  const blob = `${doc.filename} ${doc.bookmark}`.toLowerCase();
  if (/affidavit|aoa|ws\b|written statement/.test(blob)) return "affidavit";
  if (/order|award|judgement|judgment|decree/.test(blob)) return "order";
  if (/letter|email|correspondence|notice/.test(blob)) return "correspondence";
  if (/plaint|petition|appeal|reply|rejoinder|ia\b|application/.test(blob)) return "pleading";
  if (/v\.|vs\.|versus/.test(blob)) return "authority";
  return "other";
}

export function migrateDoc(raw: Partial<BinderDoc> & Pick<BinderDoc, "id" | "filename">): BinderDoc {
  const { id, filename, ...rest } = raw;
  const doc = blankDoc({
    id,
    filename,
    pageCount: rest.pageCount ?? 0,
    fields: rest.fields,
    bookmark: rest.bookmark,
    autoBk: rest.autoBk,
    pageFrom: rest.pageFrom,
    pageTo: rest.pageTo,
    flagged: rest.flagged,
    notes: rest.notes,
    exhibit: rest.exhibit,
    kind: rest.kind,
    hash: rest.hash,
    searchText: rest.searchText,
    holding: rest.holding,
  });
  if (!raw.kind) doc.kind = guessKind(doc);
  return doc;
}

export function migrateMatter(raw: Matter): Matter {
  return {
    ...raw,
    config: { ...DEFAULT_CONFIG, ...raw.config },
    columns: raw.columns ?? [],
    docs: (raw.docs ?? []).map((d) => migrateDoc(d)),
    deadlines: raw.deadlines ?? [],
    oralOutline: raw.oralOutline ?? "",
  };
}
