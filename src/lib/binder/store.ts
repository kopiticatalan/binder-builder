import { create } from "zustand";
import { mapPool, newId } from "@/lib/utils";
import { deleteBytes, loadBytes, loadState, saveBytes, saveState } from "./idb";
import { autoBookmark, applyExhibitScheme, guessFields, guessKind } from "./guess";
import { fingerprintPdf } from "./hash";
import { migrateMatter } from "./migrate";
import { extractSearchText } from "./pdf-text";
import { stampCaption, blankMatter, columnsFrom, configFrom, createMatter, matterNameFrom, TEMPLATES } from "./templates";
import type {
  AccentId,
  BinderConfig,
  BinderDoc,
  Column,
  Deadline,
  FieldValue,
  HearingNote,
  Issue,
  Matter,
  NextStep,
  OrderMeta,
  PaperKind,
} from "./types";
import { blankDoc } from "./types";
import { PDFDocument } from "pdf-lib";
import { useCourt } from "./court-store";

export type StatusKind = "idle" | "ok" | "err" | "busy";
export type PaperSort = "order" | "date" | "name" | "flagged" | "kind";

type DocketPatch = Partial<
  Pick<
    Matter,
    | "petitioner"
    | "respondent"
    | "stage"
    | "status"
    | "lastCoram"
    | "lastListing"
    | "filedOn"
    | "partner"
    | "associates"
    | "tags"
  >
>;

interface BinderState {
  ready: boolean;
  accent: AccentId;
  matters: Matter[];
  activeId: string | null;
  status: string;
  statusKind: StatusKind;
  past: Matter[];
  hydrate: () => Promise<void>;
  setAccent: (a: AccentId) => void;
  setStatus: (msg: string, kind?: StatusKind) => void;
  active: () => Matter | null;
  undo: () => void;
  patchActive: (fn: (m: Matter) => void, opts?: { undo?: boolean }) => void;
  patchMatter: (id: string, fn: (m: Matter) => void, opts?: { undo?: boolean }) => void;
  upsertMatter: (m: Matter) => void;
  importTrackerMatters: (incoming: Matter[]) => { added: number; updated: number };
  newMatter: (templateId?: string) => string;
  loadBlank: () => string;
  duplicateActive: () => string | null;
  deleteMatter: (id: string) => void;
  setActive: (id: string) => void;
  renameActive: (name: string) => void;
  applyTemplate: (templateId: string, keepDocs: boolean) => void;
  patchConfig: (partial: Partial<BinderConfig>) => void;
  setCauseTitle: (v: string) => void;
  setOralOutline: (v: string) => void;
  patchDocket: (partial: DocketPatch) => void;
  stampCaptionFromDocket: () => void;
  addTask: (t?: Partial<NextStep>) => void;
  updateTask: (id: string, patch: Partial<NextStep>) => void;
  toggleTask: (id: string, done?: boolean) => void;
  removeTask: (id: string) => void;
  addNote: (text: string) => void;
  updateNote: (id: string, patch: Partial<HearingNote>) => void;
  removeNote: (id: string) => void;
  addOrder: (o?: Partial<OrderMeta>) => void;
  updateOrder: (id: string, patch: Partial<OrderMeta>) => void;
  removeOrder: (id: string) => void;
  addIssue: (t?: Partial<Issue>) => void;
  updateIssue: (id: string, patch: Partial<Issue>) => void;
  removeIssue: (id: string) => void;
  addDeadline: (d?: Partial<Deadline>) => void;
  updateDeadline: (id: string, patch: Partial<Deadline>) => void;
  removeDeadline: (id: string) => void;
  setColumns: (cols: Column[]) => void;
  addColumn: () => void;
  updateColumn: (id: string, patch: Partial<Column>) => void;
  moveColumn: (id: string, dir: -1 | 1) => void;
  removeColumn: (id: string) => void;
  addPdfFiles: (files: File[]) => Promise<void>;
  removeDoc: (id: string) => void;
  moveDoc: (id: string, dir: -1 | 1) => void;
  reorderDocs: (from: number, to: number) => void;
  sortDocs: (by: PaperSort) => void;
  patchDoc: (id: string, patch: Partial<BinderDoc>) => void;
  setField: (docId: string, colId: string, value: FieldValue) => void;
  setDocKind: (id: string, kind: PaperKind) => void;
  renumberExhibits: () => void;
  importMatter: (matter: Matter, buffers: Record<string, ArrayBuffer>) => void;
  loadSamples: () => Promise<void>;
  loadPractice: () => void;
  clearSample: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistNow(get: () => BinderState) {
  const { matters, activeId, accent } = get();
  void saveState({ matters, activeId, accent });
}

function schedulePersist(get: () => BinderState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistNow(get), 350);
}

function touch(m: Matter): Matter {
  m.updatedAt = Date.now();
  m.name = matterNameFrom(m) || m.name;
  return m;
}

function cloneMatter(m: Matter): Matter {
  return {
    ...m,
    config: { ...m.config },
    columns: m.columns.map((c) => ({ ...c })),
    docs: m.docs.map((d) => ({ ...d, fields: { ...d.fields } })),
    deadlines: (m.deadlines ?? []).map((d) => ({ ...d })),
    oralOutline: m.oralOutline ?? "",
    tags: [...(m.tags ?? [])],
    hearingNotes: (m.hearingNotes ?? []).map((n) => ({ ...n })),
    tasks: (m.tasks ?? []).map((t) => ({ ...t })),
    orders: (m.orders ?? []).map((o) => ({ ...o })),
    issues: (m.issues ?? []).map((i) => ({ ...i, docIds: [...i.docIds] })),
  };
}

export const useBinder = create<BinderState>((set, get) => ({
  ready: false,
  accent: "cyan",
  matters: [],
  activeId: null,
  status: "Ready.",
  statusKind: "idle",
  past: [],

  hydrate: async () => {
    if (get().ready) return;
    const saved = await loadState();
    if (saved && saved.matters.length) {
      const matters = saved.matters.map(migrateMatter);
      set({
        ready: true,
        matters,
        activeId:
          saved.activeId && matters.some((m) => m.id === saved.activeId) ? saved.activeId : matters[0].id,
        accent: saved.accent || "cyan",
      });
      return;
    }
    set({ ready: true, matters: [], activeId: null, accent: saved?.accent || "cyan" });
  },

  setAccent: (accent) => {
    set({ accent });
    schedulePersist(get);
  },

  setStatus: (status, statusKind = "idle") => set({ status, statusKind }),

  active: () => {
    const { matters, activeId } = get();
    return matters.find((m) => m.id === activeId) ?? null;
  },

  undo: () => {
    const { past, matters, activeId } = get();
    const prev = past[past.length - 1];
    if (!prev) {
      set({ status: "Nothing to undo.", statusKind: "idle" });
      return;
    }
    const exists = matters.some((m) => m.id === prev.id);
    set({
      past: past.slice(0, -1),
      matters: exists ? matters.map((m) => (m.id === prev.id ? prev : m)) : [prev, ...matters],
      activeId: prev.id,
      status: "Undid last change.",
      statusKind: "ok",
    });
    persistNow(get);
  },

  patchActive: (fn, opts) => {
    const id = get().activeId;
    if (!id) return;
    get().patchMatter(id, fn, opts);
  },

  patchMatter: (id, fn, opts) => {
    const { matters, activeId, past } = get();
    const current = matters.find((m) => m.id === id);
    if (!current) return;
    const shouldUndo = opts?.undo !== false;
    const nextPast = shouldUndo && id === activeId ? [...past.slice(-19), cloneMatter(current)] : past;
    set({
      past: nextPast,
      matters: matters.map((m) => {
        if (m.id !== id) return m;
        const copy = cloneMatter(m);
        fn(copy);
        return touch(copy);
      }),
    });
    schedulePersist(get);
  },

  upsertMatter: (incoming) => {
    const { matters } = get();
    const exists = matters.some((m) => m.id === incoming.id);
    const next = exists
      ? matters.map((m) => (m.id === incoming.id ? touch(incoming) : m))
      : [incoming, ...matters];
    set({ matters: next, activeId: incoming.id, past: [] });
    persistNow(get);
    useCourt.getState().reannotate(next);
  },

  importTrackerMatters: (incoming) => {
    const byId = new Map(get().matters.map((m) => [m.id, m]));
    let added = 0;
    let updated = 0;
    for (const m of incoming) {
      if (byId.has(m.id)) {
        const old = byId.get(m.id)!;
        byId.set(m.id, {
          ...old,
          ...m,
          docs: old.docs,
          columns: old.columns.length ? old.columns : m.columns,
          config: { ...old.config, ...m.config },
          hearingNotes: m.hearingNotes?.length ? m.hearingNotes : old.hearingNotes,
          tasks: m.tasks?.length ? m.tasks : old.tasks,
          issues: old.issues.length ? old.issues : m.issues,
          sample: false,
        });
        updated += 1;
      } else {
        byId.set(m.id, { ...m, sample: false });
        added += 1;
      }
    }
    const matters = [...byId.values()];
    set({
      matters,
      activeId: get().activeId && matters.some((m) => m.id === get().activeId) ? get().activeId : matters[0]?.id ?? null,
    });
    persistNow(get);
    useCourt.getState().reannotate(matters);
    return { added, updated };
  },

  newMatter: (templateId) => {
    const t = templateId ? TEMPLATES.find((x) => x.id === templateId) : undefined;
    const m = t ? createMatter(t) : blankMatter();
    set((s) => ({ matters: [m, ...s.matters], activeId: m.id, past: [] }));
    persistNow(get);
    return m.id;
  },

  loadBlank: () => {
    const m = blankMatter();
    set((s) => ({ matters: [m, ...s.matters], activeId: m.id, past: [] }));
    persistNow(get);
    return m.id;
  },

  duplicateActive: () => {
    const cur = get().active();
    if (!cur) return null;
    const m: Matter = {
      ...cloneMatter(cur),
      id: newId(),
      name: `${cur.name} copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      docs: [],
      sample: false,
    };
    set((s) => ({ matters: [m, ...s.matters], activeId: m.id }));
    persistNow(get);
    return m.id;
  },

  deleteMatter: (id) => {
    const { matters, activeId } = get();
    const target = matters.find((m) => m.id === id);
    target?.docs.forEach((d) => void deleteBytes(d.id));
    const next = matters.filter((m) => m.id !== id);
    const nextActive = activeId === id ? (next[0]?.id ?? null) : activeId;
    set({ matters: next, activeId: nextActive, past: [] });
    persistNow(get);
    useCourt.getState().reannotate(next);
  },

  setActive: (id) => {
    set({ activeId: id, past: [] });
    persistNow(get);
  },

  renameActive: (name) => {
    get().patchActive((m) => {
      m.name = name.slice(0, 80);
    });
  },

  applyTemplate: (templateId, keepDocs) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    get().patchActive((m) => {
      m.templateId = t.id;
      const keep = {
        caseNumber: m.config.caseNumber,
        hearingDate: m.config.hearingDate,
        appearingFor: m.config.appearingFor,
        filedBy: m.config.filedBy,
        court: m.config.court || t.config.court || "",
      };
      m.config = { ...configFrom(t), ...keep };
      m.columns = columnsFrom(t);
      if (m.petitioner.trim() && m.respondent.trim()) stampCaption(m);
      if (!keepDocs) {
        m.docs.forEach((d) => void deleteBytes(d.id));
        m.docs = [];
      } else {
        m.docs.forEach((d) => {
          if (d.autoBk) d.bookmark = autoBookmark(d, m.columns);
        });
      }
    });
  },

  patchConfig: (partial) => {
    get().patchActive((m) => {
      m.config = { ...m.config, ...partial };
      if (partial.exhibitScheme && partial.exhibitScheme !== "none") {
        applyExhibitScheme(m.docs, partial.exhibitScheme);
      }
    });
  },

  setCauseTitle: (v) => {
    get().patchActive((m) => {
      m.config.causeTitle = v;
    }, { undo: false });
  },

  setOralOutline: (v) => {
    get().patchActive((m) => {
      m.oralOutline = v;
    }, { undo: false });
  },

  patchDocket: (partial) => {
    get().patchActive((m) => {
      Object.assign(m, partial);
    }, { undo: false });
  },

  stampCaptionFromDocket: () => {
    get().patchActive((m) => {
      stampCaption(m);
    });
  },

  addTask: (t) => {
    get().patchActive((m) => {
      m.tasks = [
        ...(m.tasks ?? []),
        {
          id: newId(),
          text: t?.text || "Next step",
          done: false,
          due: t?.due || "",
          note: t?.note || "",
        },
      ];
    });
  },

  updateTask: (id, patch) => {
    get().patchActive((m) => {
      m.tasks = (m.tasks ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    }, { undo: false });
  },

  toggleTask: (id, done) => {
    get().patchActive((m) => {
      m.tasks = (m.tasks ?? []).map((x) =>
        x.id === id ? { ...x, done: done ?? !x.done } : x,
      );
    }, { undo: false });
  },

  removeTask: (id) => {
    get().patchActive((m) => {
      m.tasks = (m.tasks ?? []).filter((x) => x.id !== id);
    });
  },

  addNote: (text) => {
    const note: HearingNote = {
      id: newId(),
      text,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    get().patchActive((m) => {
      m.hearingNotes = [note, ...(m.hearingNotes ?? [])];
    });
  },

  updateNote: (id, patch) => {
    get().patchActive((m) => {
      m.hearingNotes = (m.hearingNotes ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n));
    }, { undo: false });
  },

  removeNote: (id) => {
    get().patchActive((m) => {
      m.hearingNotes = (m.hearingNotes ?? []).filter((n) => n.id !== id);
    });
  },

  addOrder: (o) => {
    get().patchActive((m) => {
      m.orders = [
        {
          id: newId(),
          date: o?.date || "",
          title: o?.title || "Order",
          coram: o?.coram || "",
          excerpt: o?.excerpt || "",
        },
        ...(m.orders ?? []),
      ];
    });
  },

  updateOrder: (id, patch) => {
    get().patchActive((m) => {
      m.orders = (m.orders ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    }, { undo: false });
  },

  removeOrder: (id) => {
    get().patchActive((m) => {
      m.orders = (m.orders ?? []).filter((x) => x.id !== id);
    });
  },

  addIssue: (t) => {
    get().patchActive((m) => {
      m.issues = [
        ...(m.issues ?? []),
        {
          id: newId(),
          text: t?.text || "Issue",
          note: t?.note || "",
          docIds: t?.docIds ? [...t.docIds] : [],
        },
      ];
    });
  },

  updateIssue: (id, patch) => {
    get().patchActive((m) => {
      m.issues = (m.issues ?? []).map((x) =>
        x.id === id ? { ...x, ...patch, docIds: patch.docIds ? [...patch.docIds] : x.docIds } : x,
      );
    }, { undo: false });
  },

  removeIssue: (id) => {
    get().patchActive((m) => {
      m.issues = (m.issues ?? []).filter((x) => x.id !== id);
    });
  },

  addDeadline: (d) => {
    get().addTask({ text: d?.label || "Next listing", due: d?.date || "", note: d?.note || "" });
  },

  updateDeadline: (id, patch) => {
    get().updateTask(id, { text: patch.label, due: patch.date, note: patch.note });
  },

  removeDeadline: (id) => {
    get().removeTask(id);
  },

  setColumns: (cols) => {
    get().patchActive((m) => {
      m.columns = cols;
    });
  },

  addColumn: () => {
    get().patchActive((m) => {
      m.columns.push({ id: newId(), name: "New column", type: "text", weight: 15 });
    });
  },

  updateColumn: (id, patch) => {
    get().patchActive((m) => {
      m.columns = m.columns.map((c) => (c.id === id ? { ...c, ...patch } : c));
    });
  },

  moveColumn: (id, dir) => {
    get().patchActive((m) => {
      const i = m.columns.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.columns.length) return;
      const next = [...m.columns];
      [next[i], next[j]] = [next[j], next[i]];
      m.columns = next;
    });
  },

  removeColumn: (id) => {
    get().patchActive((m) => {
      m.columns = m.columns.filter((c) => c.id !== id);
    });
  },

  addPdfFiles: async (files) => {
    const pdfs = files.filter((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      set({ status: "Drop PDF files only.", statusKind: "err" });
      return;
    }
    set({ status: `Reading ${pdfs.length} PDF${pdfs.length === 1 ? "" : "s"}…`, statusKind: "busy" });
    const matter = get().active();
    if (!matter) return;
    const existingHashes = new Set(matter.docs.map((d) => d.hash).filter(Boolean));
    const skipped: string[] = [];
    try {
      const added = (
        await mapPool(pdfs, 3, async (f) => {
          const buf = await f.arrayBuffer();
          const stored = buf.slice(0);
          const pd = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
          const pageCount = pd.getPageCount();
          const hash = await fingerprintPdf(stored, f.name, pageCount);
          if (hash && existingHashes.has(hash)) {
            skipped.push(f.name);
            return null;
          }
          existingHashes.add(hash);
          const doc = blankDoc({
            id: newId(),
            filename: f.name,
            pageCount,
            hash,
          });
          guessFields(doc, matter.columns);
          doc.kind = guessKind(doc);
          if (matter.config.exhibitScheme !== "none") doc.exhibit = "";
          if (doc.autoBk) doc.bookmark = autoBookmark(doc, matter.columns);
          await saveBytes(doc.id, stored);
          return { doc, stored };
        })
      ).filter((x): x is { doc: BinderDoc; stored: ArrayBuffer } => x != null);

      get().patchActive((m) => {
        m.docs = [...m.docs, ...added.map((x) => x.doc)];
        if (m.config.exhibitScheme !== "none") applyExhibitScheme(m.docs, m.config.exhibitScheme);
        m.docs.forEach((d) => {
          if (d.autoBk) d.bookmark = autoBookmark(d, m.columns);
        });
      });

      const dupNote = skipped.length ? ` Skipped ${skipped.length} duplicate${skipped.length === 1 ? "" : "s"}.` : "";
      set({
        status: `${get().active()?.docs.length ?? 0} document(s) loaded.${dupNote}`,
        statusKind: "ok",
      });

      void (async () => {
        await mapPool(added, 2, async ({ doc, stored }) => {
          try {
            const text = await extractSearchText(stored.slice(0), Math.min(12, doc.pageCount), 20000);
            if (!text) return;
            get().patchActive((m) => {
              m.docs = m.docs.map((d) => (d.id === doc.id ? { ...d, searchText: text } : d));
            }, { undo: false });
          } catch {
            /* indexing is best-effort */
          }
        });
      })();
    } catch (err) {
      set({
        status: err instanceof Error ? err.message : "Could not read one of the PDFs.",
        statusKind: "err",
      });
    }
  },

  removeDoc: (id) => {
    void deleteBytes(id);
    void import("./pdf-view").then((m) => m.evictPdf(id)).catch(() => {});
    get().patchActive((m) => {
      m.docs = m.docs.filter((d) => d.id !== id);
      m.issues = (m.issues ?? []).map((iss) => ({
        ...iss,
        docIds: iss.docIds.filter((x) => x !== id),
      }));
    });
  },

  moveDoc: (id, dir) => {
    get().patchActive((m) => {
      const i = m.docs.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.docs.length) return;
      const next = [...m.docs];
      [next[i], next[j]] = [next[j], next[i]];
      m.docs = next;
      if (m.config.exhibitScheme !== "none") applyExhibitScheme(m.docs, m.config.exhibitScheme);
    });
  },

  reorderDocs: (from, to) => {
    get().patchActive((m) => {
      const next = [...m.docs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      m.docs = next;
      if (m.config.exhibitScheme !== "none") applyExhibitScheme(m.docs, m.config.exhibitScheme);
    });
  },

  sortDocs: (by) => {
    get().patchActive((m) => {
      const dated = (d: BinderDoc) => {
        const col = m.columns.find((c) => c.type === "date");
        const v = col ? d.fields[col.id] : "";
        return typeof v === "string" ? v : "";
      };
      const next = [...m.docs];
      if (by === "name") next.sort((a, b) => a.filename.localeCompare(b.filename));
      else if (by === "date") next.sort((a, b) => dated(a).localeCompare(dated(b)));
      else if (by === "flagged") next.sort((a, b) => Number(b.flagged) - Number(a.flagged));
      else if (by === "kind") next.sort((a, b) => a.kind.localeCompare(b.kind));
      m.docs = next;
      if (m.config.exhibitScheme !== "none") applyExhibitScheme(m.docs, m.config.exhibitScheme);
    });
  },

  patchDoc: (id, patch) => {
    get().patchActive((m) => {
      m.docs = m.docs.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...patch };
        if (next.autoBk) next.bookmark = autoBookmark(next, m.columns);
        return next;
      });
    });
  },

  setField: (docId, colId, value) => {
    get().patchActive((m) => {
      m.docs = m.docs.map((d) => {
        if (d.id !== docId) return d;
        const next = { ...d, fields: { ...d.fields, [colId]: value } };
        if (next.autoBk) next.bookmark = autoBookmark(next, m.columns);
        return next;
      });
    }, { undo: false });
  },

  setDocKind: (id, kind) => {
    get().patchActive((m) => {
      m.docs = m.docs.map((d) => (d.id === id ? { ...d, kind } : d));
    });
  },

  renumberExhibits: () => {
    get().patchActive((m) => {
      applyExhibitScheme(m.docs, m.config.exhibitScheme);
    });
  },

  importMatter: (matter, buffers) => {
    const imported = migrateMatter({
      ...matter,
      id: newId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sample: false,
    });
    const pairs = imported.docs.map((d) => ({ oldId: d.id, doc: { ...d, id: newId() } }));
    imported.docs = pairs.map((p) => p.doc);
    void Promise.all(
      pairs.map(async ({ oldId, doc }) => {
        const buf = buffers[oldId];
        if (buf) await saveBytes(doc.id, buf);
      }),
    ).then(() => persistNow(get));
    set((s) => ({ matters: [imported, ...s.matters], activeId: imported.id, past: [] }));
  },

  loadSamples: async () => {
    set({ status: "Building sample authorities…", statusKind: "busy" });
    const { makeSampleDocs } = await import("./samples");
    let matter = get().active();
    if (!matter) {
      get().loadBlank();
      matter = get().active();
    }
    if (!matter) return;
    if (!matter.columns.some((c) => c.type === "case")) {
      get().patchActive((m) => {
        if (m.columns.some((c) => c.type === "case")) return;
        m.columns.splice(1, 0, { id: newId(), name: "Judgement Particulars", type: "case", weight: 50 });
        if (!m.columns.some((c) => c.type === "text" && /para/i.test(c.name))) {
          m.columns.splice(2, 0, { id: newId(), name: "Relevant Paras", type: "text", weight: 18 });
        }
        if (!m.columns.some((c) => c.type === "date")) {
          m.columns.push({ id: newId(), name: "Date", type: "date", weight: 14 });
        }
      });
      matter = get().active();
    }
    if (!matter) return;
    const { docs, buffers } = await makeSampleDocs(matter.columns);
    for (let i = 0; i < docs.length; i++) {
      await saveBytes(docs[i].id, buffers[i]);
    }
    get().patchActive((m) => {
      m.docs = [...m.docs, ...docs];
      m.docs.forEach((d) => {
        if (d.autoBk) d.bookmark = autoBookmark(d, m.columns);
      });
      if (!m.config.hearingDate) m.config.hearingDate = new Date().toISOString().slice(0, 10);
      if (!m.config.appearingFor) m.config.appearingFor = "the Applicant";
      if (!(m.issues ?? []).length) {
        m.issues = [
          {
            id: newId(),
            text: "Whether the Code occupies the field vis-à-vis inconsistent state law",
            note: "Innoventive · s. 238",
            docIds: docs.filter((d) => /Innoventive/i.test(d.filename)).map((d) => d.id),
          },
          {
            id: newId(),
            text: "Object of the Code at the admission stage",
            note: "Swiss Ribbons · not a recovery statute",
            docIds: docs.filter((d) => /Swiss/i.test(d.filename)).map((d) => d.id),
          },
          {
            id: newId(),
            text: "Whether Section 7 leaves residual discretion after debt and default",
            note: "Vidarbha — cite narrowly",
            docIds: docs.filter((d) => /Vidarbha/i.test(d.filename)).map((d) => d.id),
          },
        ];
      }
    });
    set({ status: "Sample compilation loaded. Build it from the last tab.", statusKind: "ok" });
  },

  loadPractice: () => {
    if (get().matters.some((m) => m.sample)) {
      set({ status: "Sample practice is already on this device.", statusKind: "idle" });
      return;
    }
    void import("./practice").then(({ makePracticeMatters }) => {
      const samples = makePracticeMatters();
      set((s) => ({
        matters: [...samples, ...s.matters],
        activeId: samples[0]?.id ?? s.activeId,
        past: [],
        status: "Four Bombay High Court matters loaded. Nothing is uploaded.",
        statusKind: "ok",
      }));
      persistNow(get);
    });
  },

  clearSample: () => {
    const { matters, activeId } = get();
    const next = matters.filter((m) => !m.sample);
    const nextActive = next.some((m) => m.id === activeId) ? activeId : (next[0]?.id ?? null);
    set({ matters: next, activeId: nextActive, past: [], status: "Sample matters removed.", statusKind: "ok" });
    persistNow(get);
  },
}));

export async function bytesForDoc(id: string) {
  return loadBytes(id);
}
