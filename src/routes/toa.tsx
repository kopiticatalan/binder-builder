import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Gavel, Star } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { PageShell } from "@/components/metro/shell";
import { MetroButton } from "@/components/metro/controls";
import { runToa } from "@/lib/binder/actions";
import { tableOfAuthorities, TOA_ORDER } from "@/lib/binder/toa";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/toa")({ component: ToaPage });

function ToaPage() {
  const navigate = useNavigate();
  const matter = useBinder((s) => s.active());
  const setStatus = useBinder((s) => s.setStatus);
  const grouped = matter ? tableOfAuthorities(matter) : null;
  const total = grouped ? TOA_ORDER.reduce((n, k) => n + grouped[k].length, 0) : 0;
  const starred = grouped ? TOA_ORDER.reduce((n, k) => n + grouped[k].filter((r) => r.flagged).length, 0) : 0;

  if (!matter) {
    return (
      <PageShell title="authorities" backTo="/" backLabel="start">
        <p className="text-muted">Open a matter first.</p>
      </PageShell>
    );
  }

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <PageShell
        title="authorities"
        backTo="/docket"
        backLabel="docket"
        kicker={
          <p className="mb-2 max-w-xl text-sm text-muted">
            {matter.name} · {total} cited · {starred} starred. Tap a row to open it in hearing.
          </p>
        }
      >
        <div className="mb-8 flex flex-wrap gap-2">
          <MetroButton
            variant="accent"
            onClick={() => {
              setStatus("Exporting table of authorities…", "busy");
              void runToa(matter)
                .then(() => setStatus("Table of authorities exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            }}
          >
            Export Word
          </MetroButton>
          <MetroButton onClick={() => void navigate({ to: "/hearing" })}>Hearing deck</MetroButton>
        </div>

        {total === 0 ? (
          <p className="max-w-xl text-sm text-muted">
            No case names yet. On Papers, fill the case column or tap Read cite — then this list groups Supreme Court,
            High Courts, tribunals and the rest.
          </p>
        ) : (
          <div className="max-w-3xl space-y-12">
            {TOA_ORDER.map((bucket) => {
              const rows = grouped?.[bucket] ?? [];
              if (!rows.length) return null;
              return (
                <section key={bucket}>
                  <h2 className="font-display text-4xl font-light leading-none tracking-tight md:text-5xl">{bucket}</h2>
                  <ul className="mt-5 divide-y divide-line border border-line">
                    {rows.map((r) => (
                      <li key={r.docId}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 px-4 py-4 text-left"
                          onClick={() =>
                            void navigate({ href: `/hearing?doc=${encodeURIComponent(r.docId)}` })
                          }
                        >
                          <Star className={cn("mt-1 size-4 shrink-0", r.flagged ? "fill-accent text-accent" : "text-subtle")} />
                          <span className="min-w-0">
                            <span className="block font-display text-2xl font-light leading-tight">{r.name}</span>
                            <span className="mt-1 block text-sm italic text-muted">
                              {r.cite || "No citation yet"}
                              {r.paras ? ` · paras ${r.paras}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </PageShell>
      <AppBar
        actions={[
          {
            id: "hearing",
            label: "Hearing",
            icon: <Gavel />,
            accent: true,
            onClick: () => void navigate({ to: "/hearing" }),
          },
          {
            id: "word",
            label: "Word",
            icon: <FileText />,
            onClick: () => {
              setStatus("Exporting table of authorities…", "busy");
              void runToa(matter)
                .then(() => setStatus("Table of authorities exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            },
          },
        ]}
      />
    </main>
  );
}
