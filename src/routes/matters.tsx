import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { MetroButton } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { parseBackupZip } from "@/lib/binder/io";
import { useBinder } from "@/lib/binder/store";
import { effectivePages } from "@/lib/binder/types";

export const Route = createFileRoute("/matters")({ component: MattersPage });

function MattersPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const activeId = useBinder((s) => s.activeId);
  const setActive = useBinder((s) => s.setActive);
  const deleteMatter = useBinder((s) => s.deleteMatter);
  const duplicateActive = useBinder((s) => s.duplicateActive);
  const newMatter = useBinder((s) => s.newMatter);
  const loadBlank = useBinder((s) => s.loadBlank);
  const importMatter = useBinder((s) => s.importMatter);
  const setStatus = useBinder((s) => s.setStatus);
  const bakRef = useRef<HTMLInputElement>(null);

  return (
    <PageShell title="matters" backTo="/" backLabel="start">
      <div className="mb-6 flex flex-wrap gap-2">
        <MetroButton
          variant="accent"
          onClick={() => {
            newMatter("nclt-compilation");
            void navigate({ to: "/binder" });
          }}
        >
          New from NCLT
        </MetroButton>
        <MetroButton
          onClick={() => {
            loadBlank();
            void navigate({ to: "/binder" });
          }}
        >
          Blank binder
        </MetroButton>
        <MetroButton
          onClick={() => {
            duplicateActive();
            void navigate({ to: "/binder" });
          }}
        >
          Duplicate open
        </MetroButton>
        <MetroButton onClick={() => bakRef.current?.click()}>Restore backup</MetroButton>
        <input
          ref={bakRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const { matter, buffers } = await parseBackupZip(f);
              importMatter(matter, buffers);
              void navigate({ to: "/binder" });
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Restore failed.", "err");
            }
          }}
        />
      </div>
      <ul className="max-w-3xl divide-y divide-line border border-line">
        {matters.map((m) => {
          const pages = m.docs.reduce((a, d) => a + effectivePages(d), 0);
          const on = m.id === activeId;
          const due = (m.deadlines ?? [])[0];
          return (
            <li key={m.id} className={on ? "bg-chrome" : undefined}>
              <button
                type="button"
                onClick={() => {
                  setActive(m.id);
                  void navigate({ to: "/binder" });
                }}
                className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
              >
                <span className="font-display text-2xl font-light leading-none">{m.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {m.docs.length} papers · {pages} pp · {new Date(m.updatedAt).toLocaleString()}
                  {on ? " · open" : ""}
                  {due?.date ? ` · next ${due.date}` : ""}
                </span>
              </button>
              <div className="flex gap-2 px-4 pb-4">
                <MetroButton
                  className="min-h-9 px-3 text-xs"
                  onClick={() => {
                    setActive(m.id);
                    void navigate({ to: "/hearing" });
                  }}
                >
                  Hearing
                </MetroButton>
                <MetroButton
                  variant="danger"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => deleteMatter(m.id)}
                >
                  Delete
                </MetroButton>
              </div>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
