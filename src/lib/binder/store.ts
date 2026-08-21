import { create } from "zustand";
import { mapPool, newId } from "@/lib/utils";
import { deleteBytes, loadBytes, loadState, saveBytes, saveState } from "./idb";
import { autoBookmark, applyExhibitScheme, guessFields, guessKind } from "./guess";
import { fingerprintPdf } from "./hash";
import { migrateMatter } from "./migrate";
import { extractSearchText } from "./pdf-text";
import { blankMatter, columnsFrom, configFrom, createMatter, matterNameFrom, TEMPLATES } from "./templates";
import type { AccentId, BinderConfig, BinderDoc, Column, Deadline, FieldValue, Matter, PaperKind } from "./types";
import { blankDoc } from "./types";
import { PDFDocument } from "pdf-lib";

export type StatusKind = "idle" | "ok" | "err" | "busy";
export type PaperSort = "order" | "date" | "name" | "flagged" | "kind";

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
  m.name = matterNameFrom(m.config) || m.name;
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
    const first = createMatter(TEMPLATES[0]);
    set({ ready: true, matters: [first], activeId: first.id, accent: "cyan" });
    persistNow(get);
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
    const { matters, activeId, past } = get();
    const current = matters.find((m) => m.id === activeId);
    if (!current) return;
    const shouldUndo = opts?.undo !== false;
    const nextPast = shouldUndo ? [...past.slice(-19), cloneMatter(current)] : past;
    set({
      past: nextPast,
      matters: matters.map((m) => {
        if (m.id !== activeId) return m;
        const copy = cloneMatter(m);
        fn(copy);
        return touch(copy);
      }),
    });
    schedulePersist(get);
  },

  newMatter: (templateId) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    const m = createMatter(t);
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
    if (!next.length) {
      const fresh = createMatter(TEMPLATES[0]);
      set({ matters: [fresh], activeId: fresh.id, past: [] });
    } else {
      set({ matters: next, activeId: nextActive, past: [] });
    }
    persistNow(get);
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
      m.config = configFrom(t);
      m.columns = columnsFrom(t);
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

  addDeadline: (d) => {
    get().patchActive((m) => {
      m.deadlines = [
        ...(m.deadlines ?? []),
        { id: newId(), label: d?.label || "Next listing", date: d?.date || "", note: d?.note || "" },
      ];
    });
  },

  updateDeadline: (id, patch) => {
    get().patchActive((m) => {
      m.deadlines = (m.deadlines ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    });
  },

  removeDeadline: (id) => {
    get().patchActive((m) => {
      m.deadlines = (m.deadlines ?? []).filter((x) => x.id !== id);
    });
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
        statusKind: skipped.length ? "ok" : "ok",
      });

      void (async () => {
        for (const { doc, stored } of added) {
          try {
            const text = await extractSearchText(stored, Math.min(6, doc.pageCount));
            if (!text) continue;
            get().patchActive((m) => {
              m.docs = m.docs.map((d) => (d.id === doc.id ? { ...d, searchText: text } : d));
            }, { undo: false });
          } catch {
            /* indexing is best-effort */
          }
        }
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
    get().patchActive((m) => {
      m.docs = m.docs.filter((d) => d.id !== id);
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
    const matter = get().active();
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
      if (!m.config.hearingDate) m.config.hearingDate = new Date().toLocaleDateString("en-IN");
      if (!m.config.appearingFor) m.config.appearingFor = "the Applicant";
    });
    set({ status: "Sample compilation loaded. Build it from Output.", statusKind: "ok" });
  },
}));

export async function bytesForDoc(id: string) {
  return loadBytes(id);
}
