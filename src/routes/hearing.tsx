import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, ListOrdered, Star } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { StatusBar } from "@/components/metro/status-bar";
import { MetroArea, MetroButton } from "@/components/metro/controls";
import { PdfPage } from "@/components/binder/pdf-page";
import { isCaseValue, type BinderDoc, type Matter } from "@/lib/binder/types";
import { paperTitle } from "@/lib/binder/toa";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hearing")({ component: HearingPage });

function docFromSearch(searchStr: string) {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  return new URLSearchParams(raw).get("doc");
}

function goHearing(navigate: ReturnType<typeof useNavigate>, docId?: string) {
  void navigate({ href: docId ? `/hearing?doc=${encodeURIComponent(docId)}` : "/hearing" });
}

function metaFor(doc: BinderDoc, matter: Matter) {
  const caseCol = matter.columns.find((c) => c.type === "case");
  const paraCol = matter.columns.find((c) => c.type === "text" && /para|proposition|pin/i.test(c.name));
  const cv = caseCol ? doc.fields[caseCol.id] : undefined;
  const name = isCaseValue(cv) ? cv.name : paperTitle(doc, matter.columns);
  const cite = isCaseValue(cv) ? cv.cite : "";
  const paras = paraCol && typeof doc.fields[paraCol.id] === "string" ? (doc.fields[paraCol.id] as string) : "";
  return { name, cite, paras };
}

function HearingPage() {
  const navigate = useNavigate();
  const matter = useBinder((s) => s.active());
  const patchDoc = useBinder((s) => s.patchDoc);
  const loadSamples = useBinder((s) => s.loadSamples);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const requested = docFromSearch(searchStr);
  const deck = useMemo(() => {
    if (!matter) return [];
    const starred = matter.docs.filter((d) => d.flagged);
    return starred.length ? starred : matter.docs;
  }, [matter]);
  const doc = deck.find((d) => d.id === requested) ?? deck[0];
  const startPage = doc?.pageFrom && doc.pageFrom > 0 ? doc.pageFrom : 1;
  const [page, setPage] = useState(startPage);
  const [notesOpen, setNotesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPage(doc?.pageFrom && doc.pageFrom > 0 ? doc.pageFrom : 1);
  }, [doc?.id, doc?.pageFrom]);

  const select = useCallback(
    (id: string) => {
      goHearing(navigate, id);
    },
    [navigate],
  );

  const turn = useCallback(
    (dir: -1 | 1) => {
      if (!doc) return;
      const i = deck.findIndex((d) => d.id === doc.id);
      const next = deck[i + dir];
      if (next) select(next.id);
    },
    [deck, doc, select],
  );

  const lastPage = doc?.pageCount ?? 1;
  const pinpoint = doc?.pageFrom && doc.pageFrom > 0 ? doc.pageFrom : 1;

  const stepPage = useCallback(
    (dir: -1 | 1) => {
      setPage((p) => Math.min(lastPage, Math.max(1, p + dir)));
    },
    [lastPage],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        turn(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        turn(-1);
      } else if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        stepPage(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        stepPage(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setPage(pinpoint);
      } else if (e.key === "s" || e.key === "S") {
        if (doc) patchDoc(doc.id, { flagged: !doc.flagged });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, stepPage, pinpoint, doc, patchDoc]);

  if (!matter || !doc) {
    return (
      <main className="min-h-dvh bg-bg text-fg">
        <StatusBar />
        <header className="px-4 pt-6 md:px-10 md:pt-8">
          <button type="button" onClick={() => void navigate({ to: "/binder" })} className="mb-3 text-sm text-accent">
            ← binder
          </button>
          <h1 className="panorama-title">hearing</h1>
        </header>
        <div className="max-w-md space-y-4 px-4 md:px-10">
          <p className="text-sm leading-relaxed text-muted">
            Star the authorities you will open, then return here. The deck is starred papers — or every paper if none are
            starred. Drop PDFs on the binder first.
          </p>
          <MetroButton variant="accent" onClick={() => void loadSamples()}>
            Load three sample authorities
          </MetroButton>
        </div>
      </main>
    );
  }

  const { name, cite, paras } = metaFor(doc, matter);
  const i = Math.max(0, deck.findIndex((d) => d.id === doc.id));
  const issues = (matter.issues ?? []).filter((iss) => iss.docIds.includes(doc.id));
  const pinLabel =
    doc.pageFrom && doc.pageTo ? `Open ${doc.pageFrom}–${doc.pageTo}` : `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}`;

  async function copyCite() {
    const line = [name, cite, paras ? `paras ${paras}` : ""].filter(Boolean).join(", ");
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <StatusBar />
      <header className="px-4 pt-6 md:px-10 md:pt-8">
        <button type="button" onClick={() => void navigate({ to: "/docket" })} className="mb-3 text-sm text-accent">
          ← docket
        </button>
        <p className="label-caps">
          {i + 1} / {deck.length} · {matter.config.hearingDate || "no listing"} · {pinLabel}
        </p>
        <h1 className="font-display text-4xl font-light leading-none tracking-tight md:text-6xl text-pretty">{name}</h1>
        {cite ? <p className="mt-3 text-lg italic text-muted">{cite}</p> : null}
        {paras ? <p className="mt-2 font-display text-2xl font-light text-accent">Paras {paras}</p> : null}
      </header>

      <section className="grid gap-6 px-4 pt-6 md:px-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted">
            <span>
              Page {page} of {doc.pageCount}
            </span>
            {doc.pageFrom ? (
              <button type="button" className="text-accent" onClick={() => setPage(pinpoint)}>
                Jump to pinpoint
              </button>
            ) : null}
          </div>
          <PdfPage key={doc.id} docId={doc.id} page={page} />
        </div>

        <aside className={cn("space-y-5", !notesOpen && "max-lg:hidden")}>
          {issues.length ? (
            <div>
              <p className="label-caps mb-2">Issue this paper goes to</p>
              <ul className="space-y-3">
                {issues.map((iss) => (
                  <li key={iss.id} className="bg-tile-cyan px-4 py-4">
                    <p className="font-display text-2xl font-light leading-tight">{iss.text}</p>
                    {iss.note ? <p className="mt-1 text-sm text-fg/80">{iss.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="label-caps mb-2">Holding</p>
            {doc.holding ? (
              <p className="text-base leading-relaxed text-pretty">{doc.holding}</p>
            ) : doc.searchText ? (
              <p className="text-sm leading-relaxed text-muted line-clamp-[10]">{doc.searchText}</p>
            ) : (
              <p className="text-sm text-muted">No extract yet. Use Holding on Papers.</p>
            )}
          </div>

          <div>
            <p className="label-caps mb-2">Speaking note</p>
            <MetroArea
              rows={7}
              value={doc.notes}
              onChange={(e) => patchDoc(doc.id, { notes: e.target.value })}
              placeholder="What you will say when this is opened…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <MetroButton onClick={() => patchDoc(doc.id, { flagged: !doc.flagged })}>
                <Star className={cn("size-4", doc.flagged && "fill-accent")} />
                {doc.flagged ? "Starred" : "Star"}
              </MetroButton>
              <MetroButton onClick={() => void copyCite()}>
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy cite"}
              </MetroButton>
            </div>
          </div>
        </aside>
      </section>

      <nav className="mt-8 flex gap-2 overflow-x-auto px-4 pb-2 md:px-10">
        {deck.map((d, idx) => {
          const short = metaFor(d, matter).name;
          const label = short.length > 28 ? short.slice(0, 26) + "…" : short;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => select(d.id)}
              className={cn(
                "min-w-40 shrink-0 px-3 py-3 text-left",
                d.id === doc.id ? "bg-accent text-accent-fg" : "bg-chrome text-fg",
              )}
            >
              <span className="block font-display text-lg font-light leading-none">
                {idx + 1}. {label}
              </span>
            </button>
          );
        })}
      </nav>

      <AppBar
        status={`${i + 1} of ${deck.length} · p. ${page}/${doc.pageCount} · ←→ papers · ↑↓ page`}
        actions={[
          {
            id: "prev-doc",
            label: "Prev",
            icon: <ChevronLeft />,
            disabled: i === 0,
            onClick: () => turn(-1),
          },
          {
            id: "prev-page",
            label: "Page −",
            icon: <ChevronLeft />,
            disabled: page <= 1,
            onClick: () => stepPage(-1),
          },
          {
            id: "next-page",
            label: "Page +",
            icon: <ChevronRight />,
            accent: true,
            disabled: page >= lastPage,
            onClick: () => stepPage(1),
          },
          {
            id: "next-doc",
            label: "Next",
            icon: <ChevronRight />,
            disabled: i >= deck.length - 1,
            onClick: () => turn(1),
          },
        ]}
        overflow={[
          {
            id: "notes",
            label: notesOpen ? "Hide notes" : "Notes / holding",
            icon: <ListOrdered />,
            onClick: () => setNotesOpen((v) => !v),
          },
          {
            id: "star",
            label: doc.flagged ? "Unstar" : "Star",
            icon: <Star />,
            onClick: () => patchDoc(doc.id, { flagged: !doc.flagged }),
          },
          {
            id: "copy",
            label: "Copy citation",
            icon: <Copy />,
            onClick: () => void copyCite(),
          },
          {
            id: "toa",
            label: "Table of authorities",
            icon: <ListOrdered />,
            onClick: () => void navigate({ to: "/toa" }),
          },
        ]}
      />
    </main>
  );
}
