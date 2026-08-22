import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/metro/shell";
import { MetroButton } from "@/components/metro/controls";
import { runChronology } from "@/lib/binder/actions";
import { parseLooseDate } from "@/lib/binder/dates";
import { docDateValue, paperTitle } from "@/lib/binder/toa";
import { KIND_LABELS, effectivePages } from "@/lib/binder/types";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chrono")({ component: ChronoPage });

function ChronoPage() {
  const navigate = useNavigate();
  const matter = useBinder((s) => s.active());
  const setStatus = useBinder((s) => s.setStatus);
  const setActive = useBinder((s) => s.setActive);
  const matters = useBinder((s) => s.matters);

  if (!matter) {
    return (
      <PageShell title="chronology" backTo="/">
        <p className="text-muted">Open a matter first.</p>
      </PageShell>
    );
  }

  const rows = matter.docs
    .map((d, i) => {
      const raw = docDateValue(d, matter.columns);
      const parsed = parseLooseDate(raw);
      return { d, i, raw, t: parsed ? parsed.getTime() : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.t - b.t || a.i - b.i);

  const undated = rows.filter((r) => r.t === Number.POSITIVE_INFINITY).length;

  return (
    <PageShell
      title="chronology"
      backTo="/binder"
      backLabel="binder"
      kicker={<p className="mb-2 text-sm text-muted">{matter.name}</p>}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <MetroButton
          variant="accent"
          onClick={() => {
            setStatus("Building chronology…", "busy");
            void runChronology(matter)
              .then(() => setStatus("Chronology exported.", "ok"))
              .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
          }}
        >
          Export Word
        </MetroButton>
        {matters.length > 1 ? (
          <MetroButton
            onClick={() => {
              const idx = matters.findIndex((m) => m.id === matter.id);
              const next = matters[(idx + 1) % matters.length];
              setActive(next.id);
            }}
          >
            Next matter
          </MetroButton>
        ) : null}
      </div>
      {undated ? (
        <p className="mb-4 text-sm text-muted">
          {undated} paper{undated === 1 ? "" : "s"} without a date — they sit at the end. Fill the date column on Papers.
        </p>
      ) : null}
      <ol className="max-w-3xl">
        {rows.map((r) => (
          <li key={r.d.id} className="relative border-l-2 border-line pl-5 pb-8 last:pb-0">
            <span
              className={cn(
                "absolute -left-[5px] top-1 size-2",
                r.d.flagged ? "bg-accent" : "bg-subtle",
              )}
            />
            <button
              type="button"
              className="w-full text-left"
              onClick={() => void navigate({ href: `/hearing?doc=${encodeURIComponent(r.d.id)}` })}
            >
              <p className="label-caps">{r.raw || "undated"}</p>
              <p className="font-display text-2xl font-light leading-tight">{paperTitle(r.d, matter.columns)}</p>
              <p className="text-xs text-muted">
                {KIND_LABELS[r.d.kind]} · {effectivePages(r.d)} pp
                {r.d.flagged ? " · to be read" : ""}
              </p>
            </button>
          </li>
        ))}
      </ol>
      {rows.length === 0 ? <p className="text-muted">No papers in this matter.</p> : null}
      <p className="mt-8">
        <button type="button" className="text-sm text-accent" onClick={() => void navigate({ to: "/binder" })}>
          Edit papers →
        </button>
      </p>
    </PageShell>
  );
}
