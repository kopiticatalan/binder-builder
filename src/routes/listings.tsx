import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/metro/shell";
import { MetroButton } from "@/components/metro/controls";
import { boardRows, dayPhrase, downloadHearingsIcs } from "@/lib/binder/docket";
import { useBinder } from "@/lib/binder/store";

export const Route = createFileRoute("/listings")({ component: ListingsPage });

function ListingsPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const setActive = useBinder((s) => s.setActive);
  const setStatus = useBinder((s) => s.setStatus);
  const newMatter = useBinder((s) => s.newMatter);
  const rows = boardRows(matters);
  const upcoming = rows.filter((r) => r.days >= 0);
  const past = rows.filter((r) => r.days < 0);

  return (
    <PageShell title="board" backTo="/" backLabel="start">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed text-pretty">
        Every matter with a next listing, in date order. You type the date on the docket — this is not a live cause-list
        scrape, so it works for any court.
      </p>
      <div className="mb-8 flex flex-wrap gap-2">
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
            try {
              const n = downloadHearingsIcs(matters);
              setStatus(`Exported ${n} calendar event${n === 1 ? "" : "s"}.`, "ok");
            } catch (e) {
              setStatus(e instanceof Error ? e.message : "Nothing to export.", "err");
            }
          }}
        >
          Download .ics
        </MetroButton>
      </div>

      {upcoming.length === 0 ? (
        <p className="mb-10 text-muted">Nothing upcoming. Set a next listing on a docket.</p>
      ) : (
        <BoardList
          rows={upcoming}
          onOpen={(id) => {
            setActive(id);
            void navigate({ to: "/docket" });
          }}
        />
      )}

      {past.length ? (
        <>
          <p className="label-caps mb-3 mt-12">Past</p>
          <BoardList
            rows={past}
            onOpen={(id) => {
              setActive(id);
              void navigate({ to: "/docket" });
            }}
          />
        </>
      ) : null}
    </PageShell>
  );
}

function BoardList({
  rows,
  onOpen,
}: {
  rows: ReturnType<typeof boardRows>;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="max-w-3xl divide-y divide-line border border-line">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left" onClick={() => onOpen(r.id)}>
            <span className="font-display text-2xl font-light leading-none">{r.name}</span>
            <span className="text-xs text-muted">
              {dayPhrase(r.days)}
              {r.caseNumber ? ` · ${r.caseNumber}` : ""}
              {r.court ? ` · ${r.court}` : ""}
              {r.stage ? ` · ${r.stage}` : ""}
              {r.openTasks ? ` · ${r.openTasks} open` : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
