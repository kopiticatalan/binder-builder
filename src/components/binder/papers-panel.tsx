import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Gavel, Star, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Field, MetroButton, MetroCheck, MetroInput, MetroSelect } from "@/components/metro/controls";
import { grokAssist } from "@/lib/binder/ai";
import { extractFirstPagesText } from "@/lib/binder/pdf-text";
import { bytesForDoc, useBinder } from "@/lib/binder/store";
import { KIND_LABELS, isCaseValue, type BinderDoc, type Matter, type PaperKind } from "@/lib/binder/types";
import { cn } from "@/lib/utils";

export function PapersPanel({ matter }: { matter: Matter }) {
  const addPdfFiles = useBinder((s) => s.addPdfFiles);
  const removeDoc = useBinder((s) => s.removeDoc);
  const moveDoc = useBinder((s) => s.moveDoc);
  const patchDoc = useBinder((s) => s.patchDoc);
  const setField = useBinder((s) => s.setField);
  const setDocKind = useBinder((s) => s.setDocKind);
  const reorderDocs = useBinder((s) => s.reorderDocs);
  const sortDocs = useBinder((s) => s.sortDocs);
  const renumberExhibits = useBinder((s) => s.renumberExhibits);
  const setStatus = useBinder((s) => s.setStatus);
  const loadSamples = useBinder((s) => s.loadSamples);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [over, setOver] = useState(false);
  const [kindFilter, setKindFilter] = useState<PaperKind | "all">("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return matter.docs.filter((d) => {
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;
      if (!s) return true;
      const blob = `${d.filename} ${d.bookmark} ${d.exhibit} ${d.notes} ${d.holding} ${d.searchText} ${JSON.stringify(d.fields)}`.toLowerCase();
      return blob.includes(s);
    });
  }, [matter.docs, q, kindFilter]);

  const filtering = q.trim() !== "" || kindFilter !== "all";

  async function onFiles(files: FileList | File[]) {
    await addPdfFiles([...files]);
  }

  async function readCite(id: string, kind: "citation" | "holding") {
    setStatus(kind === "holding" ? "Reading holding…" : "Reading first pages…", "busy");
    try {
      const buf = await bytesForDoc(id);
      if (!buf) {
        setStatus("PDF bytes missing — add the file again.", "err");
        return;
      }
      const text = await extractFirstPagesText(buf, kind === "holding" ? 4 : 2);
      if (!text) {
        setStatus("No extractable text on the first pages.", "err");
        return;
      }
      const res = await grokAssist({ data: { kind, text } });
      if (!res.ok) {
        setStatus(res.error, "err");
        return;
      }
      const caseCol = matter.columns.find((c) => c.type === "case");
      if (res.kind === "citation") {
        if (caseCol) setField(id, caseCol.id, { name: res.name, cite: res.cite });
        const dateCol = matter.columns.find((c) => c.type === "date");
        if (dateCol && res.date) setField(id, dateCol.id, res.date);
        setStatus("Citation filled from the judgement.", "ok");
      } else if (res.kind === "holding") {
        if (caseCol && res.name) setField(id, caseCol.id, { name: res.name, cite: res.cite });
        const paraCol = matter.columns.find((c) => c.type === "text" && /para/i.test(c.name));
        if (paraCol && res.paras) setField(id, paraCol.id, res.paras);
        patchDoc(id, { holding: res.holding, kind: "authority" });
        setStatus("Holding extracted.", "ok");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Read failed", "err");
    }
  }

  async function batchCites() {
    const targets = matter.docs.filter((d) => {
      const caseCol = matter.columns.find((c) => c.type === "case");
      if (!caseCol) return false;
      const v = d.fields[caseCol.id];
      return !isCaseValue(v) || !v.cite.trim();
    });
    if (!targets.length) {
      setStatus("Every authority already has a citation.", "ok");
      return;
    }
    for (const d of targets.slice(0, 8)) {
      await readCite(d.id, "citation");
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over: overId } = e;
    if (!overId || active.id === overId.id) return;
    const from = matter.docs.findIndex((d) => d.id === active.id);
    const to = matter.docs.findIndex((d) => d.id === overId.id);
    if (from < 0 || to < 0) return;
    reorderDocs(from, to);
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-28 w-full flex-col items-start justify-center bg-tile-cyan px-5 py-4 text-left text-fg transition-transform duration-150 active:scale-[0.99]",
          over && "bg-tile-cobalt",
        )}
      >
        <span className="font-display text-3xl font-light">Drop PDFs</span>
        <span className="text-sm text-fg/80">or tap to add. Order here is the order in the binder.</span>
      </button>

      {matter.docs.length === 0 ? (
        <MetroButton onClick={() => void loadSamples()}>Load three sample authorities</MetroButton>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <Field label="Filter">
            <MetroInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, cite, para, text…" />
          </Field>
        </div>
        <div className="min-w-[140px]">
          <Field label="Kind">
            <MetroSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as PaperKind | "all")}>
              <option value="all">All</option>
              {Object.entries(KIND_LABELS).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </MetroSelect>
          </Field>
        </div>
        <MetroButton onClick={() => sortDocs("date")}>Sort by date</MetroButton>
        <MetroButton onClick={() => sortDocs("flagged")}>Starred first</MetroButton>
        <MetroButton onClick={renumberExhibits}>Renumber exhibits</MetroButton>
        <MetroButton onClick={() => void batchCites()}>Read cites</MetroButton>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No documents yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtered.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {filtered.map((d) => (
                <PaperCard
                  key={d.id}
                  doc={d}
                  index={matter.docs.findIndex((x) => x.id === d.id)}
                  matter={matter}
                  dragDisabled={filtering}
                  onMove={moveDoc}
                  onRemove={removeDoc}
                  onPatch={patchDoc}
                  onField={setField}
                  onKind={setDocKind}
                  onCite={readCite}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function PaperCard({
  doc: d,
  index: i,
  matter,
  dragDisabled,
  onMove,
  onRemove,
  onPatch,
  onField,
  onKind,
  onCite,
}: {
  doc: BinderDoc;
  index: number;
  matter: Matter;
  dragDisabled: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<BinderDoc>) => void;
  onField: (docId: string, colId: string, value: import("@/lib/binder/types").FieldValue) => void;
  onKind: (id: string, kind: PaperKind) => void;
  onCite: (id: string, kind: "citation" | "holding") => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: d.id,
    disabled: dragDisabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("bg-chrome p-4", isDragging && "opacity-70")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="grid size-11 place-items-center text-muted disabled:opacity-30"
          disabled={dragDisabled}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="font-display text-xl font-light">
          {i + 1}. {d.filename}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {d.pageCount} p.{d.pageFrom && d.pageTo ? ` · using ${d.pageFrom}–${d.pageTo}` : ""}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onPatch(d.id, { flagged: !d.flagged })}
          className={cn("grid size-11 place-items-center", d.flagged ? "text-accent" : "text-muted")}
          aria-label="Mark to be read"
        >
          <Star className={cn("size-5", d.flagged && "fill-accent")} />
        </button>
        <MetroButton className="px-2" onClick={() => onMove(d.id, -1)} aria-label="Up">
          <ChevronUp className="size-4" />
        </MetroButton>
        <MetroButton className="px-2" onClick={() => onMove(d.id, 1)} aria-label="Down">
          <ChevronDown className="size-4" />
        </MetroButton>
        <MetroButton className="px-2" variant="danger" onClick={() => onRemove(d.id)}>
          <Trash2 className="size-4" />
        </MetroButton>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <MetroSelect value={d.kind} onChange={(e) => onKind(d.id, e.target.value as PaperKind)}>
            {Object.entries(KIND_LABELS).map(([k, lab]) => (
              <option key={k} value={k}>
                {lab}
              </option>
            ))}
          </MetroSelect>
        </Field>
        {matter.columns.map((c) => {
          if (c.type === "case") {
            const raw = d.fields[c.id];
            const v = isCaseValue(raw) ? raw : { name: "", cite: "" };
            return (
              <div key={c.id} className="contents">
                <Field label={`${c.name} — case (bold)`}>
                  <MetroInput
                    value={v.name}
                    onChange={(e) => onField(d.id, c.id, { ...v, name: e.target.value })}
                  />
                </Field>
                <Field label={`${c.name} — citation (italic)`}>
                  <MetroInput
                    value={v.cite}
                    onChange={(e) => onField(d.id, c.id, { ...v, cite: e.target.value })}
                  />
                </Field>
              </div>
            );
          }
          if (c.type === "text" || c.type === "date") {
            return (
              <Field key={c.id} label={c.name}>
                <MetroInput
                  value={typeof d.fields[c.id] === "string" ? (d.fields[c.id] as string) : ""}
                  onChange={(e) => onField(d.id, c.id, e.target.value)}
                />
              </Field>
            );
          }
          return null;
        })}
        <Field label="Pages to include" hint={`1 – ${d.pageCount}. Leave blank for all.`}>
          <div className="flex gap-2">
            <MetroInput
              type="number"
              min={1}
              max={d.pageCount}
              placeholder="from"
              value={d.pageFrom ?? ""}
              onChange={(e) => onPatch(d.id, { pageFrom: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
            <MetroInput
              type="number"
              min={1}
              max={d.pageCount}
              placeholder="to"
              value={d.pageTo ?? ""}
              onChange={(e) => onPatch(d.id, { pageTo: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
          </div>
        </Field>
        <Field label="Exhibit / annexure">
          <MetroInput value={d.exhibit} onChange={(e) => onPatch(d.id, { exhibit: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <MetroCheck checked={d.autoBk} onChange={(v) => onPatch(d.id, { autoBk: v })} label="Auto bookmark" />
        <div className="min-w-[200px] flex-1">
          <MetroInput
            disabled={d.autoBk}
            value={d.bookmark}
            onChange={(e) => onPatch(d.id, { bookmark: e.target.value })}
            placeholder="Bookmark title"
          />
        </div>
        <MetroButton onClick={() => void onCite(d.id, "citation")}>Read cite</MetroButton>
        <MetroButton onClick={() => void onCite(d.id, "holding")}>Holding</MetroButton>
        <OpenHearing id={d.id} />
      </div>
      {d.holding ? <p className="mt-3 text-sm leading-relaxed text-muted">{d.holding}</p> : null}
      <div className="mt-3">
        <Field label="Private note (not printed)">
          <MetroInput value={d.notes} onChange={(e) => onPatch(d.id, { notes: e.target.value })} />
        </Field>
      </div>
    </li>
  );
}

function OpenHearing({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <MetroButton onClick={() => void navigate({ href: `/hearing?doc=${encodeURIComponent(id)}` })}>
      <Gavel className="size-4" />
      Hearing
    </MetroButton>
  );
}
