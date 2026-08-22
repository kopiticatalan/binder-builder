import { DEFAULT_CONFIG, emptyDocket } from "./templates";
import type { BinderDoc, Matter, NextStep, PaperKind } from "./types";
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

function tasksFrom(raw: Matter): NextStep[] {
  if (raw.tasks?.length) {
    return raw.tasks.map((t) => ({
      id: t.id,
      text: t.text || "",
      done: !!t.done,
      due: t.due || "",
      note: t.note || "",
    }));
  }
  return (raw.deadlines ?? []).map((d) => ({
    id: d.id,
    text: d.label || "Date",
    done: false,
    due: d.date || "",
    note: d.note || "",
  }));
}

export function migrateMatter(raw: Matter): Matter {
  const docket = emptyDocket();
  const status = raw.status === "Disposed" || raw.status === "Pending" ? raw.status : docket.status;
  return {
    ...docket,
    ...raw,
    config: { ...DEFAULT_CONFIG, ...raw.config },
    columns: raw.columns ?? [],
    docs: (raw.docs ?? []).map((d) => migrateDoc(d)),
    deadlines: raw.deadlines ?? [],
    oralOutline: raw.oralOutline ?? "",
    petitioner: raw.petitioner ?? "",
    respondent: raw.respondent ?? "",
    stage: raw.stage ?? "",
    status,
    lastCoram: raw.lastCoram ?? "",
    lastListing: raw.lastListing ?? "",
    filedOn: raw.filedOn ?? "",
    partner: raw.partner ?? "",
    associates: raw.associates ?? "",
    tags: raw.tags ?? [],
    hearingNotes: raw.hearingNotes ?? [],
    tasks: tasksFrom(raw),
    orders: raw.orders ?? [],
    issues: (raw.issues ?? []).map((i) => ({
      id: i.id,
      text: i.text || "",
      note: i.note || "",
      docIds: [...(i.docIds ?? [])],
    })),
    sample: raw.sample ?? false,
  };
}
