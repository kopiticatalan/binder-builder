import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { MetroButton } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { parseBackupZip } from "@/lib/binder/io";
import { partyCaption, dayPhrase } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
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
  const importMatter = useBinder((s) => s.importMatter);
  const setStatus = useBinder((s) => s.setStatus);
  const bakRef = useRef<HTMLInputElement>(null);

  function open(id: string, to: "/docket" | "/binder" | "/hearing") {
    setActive(id);
    void navigate({ to });
  }

  return (
    <PageShell title="matters" backTo="/" backLabel="start">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
        Every case on this device. New matter starts blank — any court. A template is only the look of a compilation,
        applied later if you want one.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        <MetroButton
          variant="accent"
          onClick={() => {
            newMatter();
            void navigate({ to: "/docket" });
          }}
        >
          New matter
        </MetroButton>
        <MetroButton
          onClick={() => {
            duplicateActive();
            void navigate({ to: "/docket" });
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
              void navigate({ to: "/docket" });
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Restore failed.", "err");
            }
          }}
        />
      </div>
      {matters.length === 0 ? (
        <p className="text-muted">No matters yet.</p>
      ) : (
        <ul className="max-w-3xl divide-y divide-line border border-line">
          {matters.map((m) => {
            const pages = m.docs.reduce((a, d) => a + effectivePages(d), 0);
            const on = m.id === activeId;
            const n = daysUntil(m.config.hearingDate);
            const openTasks = (m.tasks ?? []).filter((t) => !t.done).length;
            return (
              <li key={m.id} className={on ? "bg-chrome" : undefined}>
                <button
                  type="button"
                  onClick={() => open(m.id, "/docket")}
                  className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                >
                  <span className="font-display text-2xl font-light leading-none">{partyCaption(m)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {m.config.caseNumber || "No case number"}
                    {m.config.court ? ` · ${m.config.court}` : ""}
                    {m.stage ? ` · ${m.stage}` : ""}
                    {m.status === "Disposed" ? " · disposed" : ""}
                    {n != null ? ` · ${dayPhrase(n)}` : ""}
                    {openTasks ? ` · ${openTasks} open` : ""}
                    {` · ${m.docs.length} papers · ${pages} pp`}
                    {on ? " · open" : ""}
                    {m.sample ? " · sample" : ""}
                  </span>
                </button>
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  <MetroButton className="min-h-9 px-3 text-xs" onClick={() => open(m.id, "/binder")}>
                    Binder
                  </MetroButton>
                  <MetroButton className="min-h-9 px-3 text-xs" onClick={() => open(m.id, "/hearing")}>
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
      )}
    </PageShell>
  );
}
