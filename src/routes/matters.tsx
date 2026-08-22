import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Field, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { MatterCard } from "@/components/metro/matter-card";
import { PageShell } from "@/components/metro/shell";
import { parseBackupZip } from "@/lib/binder/io";
import { nextDate, partyCaption } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
import { ordersSavedMessage, refreshMatter } from "@/lib/binder/orders";
import { useBinder } from "@/lib/binder/store";
import { canFetchCourt, caseLabel, forumOf } from "@/lib/utils";

export const Route = createFileRoute("/matters")({ component: MattersPage });

function MattersPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const newMatter = useBinder((s) => s.newMatter);
  const importMatter = useBinder((s) => s.importMatter);
  const setStatus = useBinder((s) => s.setStatus);
  const bakRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [forum, setForum] = useState("");
  const [filter, setFilter] = useState("");
  const [busyAll, setBusyAll] = useState(false);

  const rows = useMemo(() => {
    const term = q.toLowerCase();
    return matters
      .filter((m) => {
        const hay = [
          partyCaption(m),
          caseLabel(m),
          m.config.caseNumber,
          m.partner,
          m.associates,
          m.cnr,
          m.status,
          m.courtStatus,
          m.stage,
        ]
          .join(" ")
          .toLowerCase();
        if (term && !hay.includes(term)) return false;
        if (forum === "sat" && forumOf(m) !== "sat") return false;
        if (forum === "nclt" && forumOf(m) !== "nclt") return false;
        if (forum === "arb" && forumOf(m) !== "arb") return false;
        if (forum === "bhc" && forumOf(m) !== "bhc") return false;
        if (forum === "2" && (forumOf(m) !== "bhc" || m.side !== "2")) return false;
        if (forum === "1" && (forumOf(m) !== "bhc" || m.side !== "1")) return false;
        if (filter === "upcoming" && !(m.config.hearingDate || m.nextListing)) return false;
        if (filter === "tasks" && !(m.tasks ?? []).some((s) => !s.done)) return false;
        if (filter === "disposed" && m.status !== "Disposed" && !/dispos/i.test(m.courtStatus)) return false;
        if (filter === "pending" && (m.status === "Disposed" || /dispos/i.test(m.courtStatus))) return false;
        return true;
      })
      .sort((a, b) => {
        const da = daysUntil(nextDate(a));
        const db = daysUntil(nextDate(b));
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
  }, [matters, q, forum, filter]);

  async function updateAll() {
    const list = rows.filter(canFetchCourt);
    if (!list.length) {
      setStatus("None of these have a court record to refresh.", "err");
      return;
    }
    setBusyAll(true);
    let added = 0;
    for (let i = 0; i < list.length; i++) {
      setStatus(`Updating orders ${i + 1} of ${list.length}…`, "busy");
      const r = await refreshMatter(list[i]);
      if (r.ok) added += r.added;
    }
    setBusyAll(false);
    setStatus(ordersSavedMessage(added, undefined, true), "ok");
  }

  return (
    <PageShell title="my matters" backTo="/" backLabel="home">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
        Your cases. One tap updates orders into that matter’s folder. Open the file here, or reveal the folder in
        Finder (Mac app).
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        <MetroButton variant="accent" onClick={() => void navigate({ to: "/fetch" })}>
          Add from court
        </MetroButton>
        <MetroButton
          onClick={() => {
            newMatter();
            void navigate({ to: "/docket" });
          }}
        >
          Add by hand
        </MetroButton>
        <MetroButton disabled={busyAll} onClick={() => void updateAll()}>
          {busyAll ? "Updating…" : "Update all orders"}
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
          <MetroInput placeholder="Party, case number, CNR" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="Court">
          <MetroSelect value={forum} onChange={(e) => setForum(e.target.value)}>
            <option value="">All</option>
            <option value="bhc">Bombay High Court</option>
            <option value="sat">SAT</option>
            <option value="nclt">NCLT</option>
            <option value="arb">Arbitration</option>
            <option value="2">Original Side</option>
            <option value="1">Appellate Side</option>
          </MetroSelect>
        </Field>
        <Field label="Show">
          <MetroSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="upcoming">With a next date</option>
            <option value="tasks">Open tasks</option>
            <option value="pending">Pending</option>
            <option value="disposed">Disposed</option>
          </MetroSelect>
        </Field>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">No matters match this view.</p>
      ) : (
        <div className="max-w-3xl space-y-3">
          {rows.map((m) => (
            <MatterCard key={m.id} matter={m} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
