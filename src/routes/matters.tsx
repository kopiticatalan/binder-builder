import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Field, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { parseBackupZip } from "@/lib/binder/io";
import { partyCaption, dayPhrase } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
import { refreshMatter } from "@/lib/binder/orders";
import { useBinder } from "@/lib/binder/store";
import { effectivePages } from "@/lib/binder/types";
import { canFetchCourt, caseLabel, forumOf } from "@/lib/utils";

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
  const [q, setQ] = useState("");
  const [forum, setForum] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");

  const rows = useMemo(() => {
    const term = q.toLowerCase();
    return matters.filter((m) => {
      const hay = [
        partyCaption(m),
        caseLabel(m),
        m.config.caseNumber,
        m.partner,
        m.associates,
        m.cnr,
        m.status,
        m.courtStatus,
      ]
        .join(" ")
        .toLowerCase();
      if (term && !hay.includes(term)) return false;
      if (forum === "sat" && forumOf(m) !== "sat") return false;
      if (forum === "nclt" && forumOf(m) !== "nclt") return false;
      if (forum === "bhc" && forumOf(m) !== "bhc") return false;
      if (forum === "2" && (forumOf(m) !== "bhc" || m.side !== "2")) return false;
      if (forum === "1" && (forumOf(m) !== "bhc" || m.side !== "1")) return false;
      if (filter === "upcoming" && !(m.config.hearingDate || m.nextListing)) return false;
      if (filter === "tasks" && !(m.tasks ?? []).some((s) => !s.done)) return false;
      if (filter === "disposed" && m.status !== "Disposed" && !/dispos/i.test(m.courtStatus)) return false;
      if (filter === "pending" && (m.status === "Disposed" || /dispos/i.test(m.courtStatus))) return false;
      return true;
    });
  }, [matters, q, forum, filter]);

  function open(id: string, to: "/docket" | "/binder" | "/hearing") {
    setActive(id);
    void navigate({ to });
  }

  return (
    <PageShell title="matters" backTo="/" backLabel="start">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
        Every case on this device. Add from the court website for a live record, or start a blank docket for any other
        forum.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        <MetroButton variant="accent" onClick={() => void navigate({ to: "/fetch" })}>
          From court
        </MetroButton>
        <MetroButton
          onClick={() => {
            newMatter();
            void navigate({ to: "/docket" });
          }}
        >
          Blank docket
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
      <div className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-3">
        <Field label="Search">
          <MetroInput
            placeholder="Party, case number, CNR, team"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Field label="Forum">
          <MetroSelect value={forum} onChange={(e) => setForum(e.target.value)}>
            <option value="">All forums</option>
            <option value="bhc">Bombay High Court</option>
            <option value="sat">SAT</option>
            <option value="nclt">NCLT</option>
            <option value="2">Original Side</option>
            <option value="1">Appellate Side</option>
          </MetroSelect>
        </Field>
        <Field label="Filter">
          <MetroSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All matters</option>
            <option value="upcoming">Upcoming</option>
            <option value="tasks">Open tasks</option>
            <option value="pending">Pending</option>
            <option value="disposed">Disposed</option>
          </MetroSelect>
        </Field>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">No matters match this view.</p>
      ) : (
        <ul className="max-w-3xl divide-y divide-line border border-line">
          {rows.map((m) => {
            const pages = m.docs.reduce((a, d) => a + effectivePages(d), 0);
            const on = m.id === activeId;
            const n = daysUntil(m.config.hearingDate || m.nextListing);
            const openTasks = (m.tasks ?? []).filter((t) => !t.done).length;
            const label = caseLabel(m) || m.config.caseNumber || "No case number";
            return (
              <li key={m.id} className={on ? "bg-chrome" : undefined}>
                <button
                  type="button"
                  onClick={() => open(m.id, "/docket")}
                  className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                >
                  <span className="font-display text-2xl font-light leading-none">{partyCaption(m)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {label}
                    {m.sideLabel ? ` · ${m.sideLabel}` : m.config.court ? ` · ${m.config.court}` : ""}
                    {m.courtStatus || m.status ? ` · ${m.courtStatus || m.status}` : ""}
                    {m.stage ? ` · ${m.stage}` : ""}
                    {n != null ? ` · ${dayPhrase(n)}` : ""}
                    {openTasks ? ` · ${openTasks} open` : ""}
                    {` · ${m.orders.filter((o) => o.downloaded).length}/${m.orders.length} orders`}
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
                  {canFetchCourt(m) ? (
                    <MetroButton
                      className="min-h-9 px-3 text-xs"
                      disabled={busy === m.id}
                      onClick={async () => {
                        setBusy(m.id);
                        setStatus("Refreshing…", "busy");
                        const r = await refreshMatter(m);
                        setBusy("");
                        if (!r.ok) setStatus(r.error, "err");
                        else setStatus(`${r.added} new order(s).`, "ok");
                      }}
                    >
                      {busy === m.id ? "…" : "Refresh"}
                    </MetroButton>
                  ) : null}
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
