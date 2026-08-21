import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { StatusBar } from "@/components/metro/status-bar";
import { MetroArea, MetroButton } from "@/components/metro/controls";
import { isCaseValue, type Matter } from "@/lib/binder/types";
import { paperTitle } from "@/lib/binder/toa";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hearing")({ component: HearingPage });

function HearingPage() {
  const navigate = useNavigate();
  const matter = useBinder((s) => s.active());
  const patchDoc = useBinder((s) => s.patchDoc);
  const deck = useMemo(() => {
    if (!matter) return [];
    const starred = matter.docs.filter((d) => d.flagged);
    return starred.length ? starred : matter.docs;
  }, [matter]);
  const [i, setI] = useState(0);
  const doc = deck[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setI((n) => Math.min(deck.length - 1, n + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setI((n) => Math.max(0, n - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length]);

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
        <p className="max-w-md px-4 text-sm leading-relaxed text-muted md:px-10">
          Star the authorities you will open, then return here. The deck is built from starred papers — or every paper if none are starred.
        </p>
      </main>
    );
  }

  const caseCol = matter.columns.find((c) => c.type === "case");
  const paraCol = matter.columns.find((c) => c.type === "text" && /para|proposition|pin/i.test(c.name));
  const cv = caseCol ? doc.fields[caseCol.id] : undefined;
  const name = isCaseValue(cv) ? cv.name : paperTitle(doc, matter.columns);
  const cite = isCaseValue(cv) ? cv.cite : "";
  const paras = paraCol && typeof doc.fields[paraCol.id] === "string" ? (doc.fields[paraCol.id] as string) : "";

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <StatusBar />
      <header className="px-4 pt-6 md:px-10 md:pt-8">
        <button type="button" onClick={() => void navigate({ to: "/binder" })} className="mb-3 text-sm text-accent">
          ← binder
        </button>
        <p className="label-caps">
          {i + 1} / {deck.length} · {matter.config.hearingDate || "no hearing date"}
        </p>
        <h1 className="font-display text-4xl font-light leading-none tracking-tight md:text-6xl">{name}</h1>
        {cite ? <p className="mt-3 text-lg italic text-muted">{cite}</p> : null}
      </header>

      <section className="grid gap-8 px-4 pt-8 md:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          {paras ? (
            <p className="mb-4 font-display text-3xl font-light text-accent">Paras {paras}</p>
          ) : null}
          {doc.pageFrom && doc.pageTo ? (
            <p className="mb-4 text-sm text-muted">
              Open pages {doc.pageFrom}–{doc.pageTo} of the original.
            </p>
          ) : null}
          {doc.holding ? (
            <p className="max-w-2xl text-lg leading-relaxed text-pretty">{doc.holding}</p>
          ) : doc.searchText ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted line-clamp-[14]">{doc.searchText}</p>
          ) : (
            <p className="text-muted">No extract yet. Use Holding on Papers.</p>
          )}
        </div>
        <div className="space-y-4">
          <p className="label-caps">Speaking note</p>
          <MetroArea
            rows={8}
            value={doc.notes}
            onChange={(e) => patchDoc(doc.id, { notes: e.target.value })}
            placeholder="What you will say when this is opened…"
          />
          <div className="flex flex-wrap gap-2">
            <MetroButton onClick={() => patchDoc(doc.id, { flagged: !doc.flagged })}>
              <Star className={cn("size-4", doc.flagged && "fill-accent")} />
              {doc.flagged ? "Starred" : "Star"}
            </MetroButton>
          </div>
        </div>
      </section>

      <nav className="mt-8 flex gap-2 overflow-x-auto px-4 md:px-10">
        {deck.map((d, idx) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setI(idx)}
            className={cn(
              "min-w-40 shrink-0 px-3 py-3 text-left",
              idx === i ? "bg-accent text-accent-fg" : "bg-chrome text-fg",
            )}
          >
            <span className="block font-display text-lg font-light leading-none">
              {idx + 1}. {shortName(d, matter)}
            </span>
          </button>
        ))}
      </nav>

      <AppBar
        status={`${i + 1} of ${deck.length} · arrows to turn`}
        actions={[
          {
            id: "prev",
            label: "Prev",
            icon: <ChevronLeft />,
            disabled: i === 0,
            onClick: () => setI((n) => Math.max(0, n - 1)),
          },
          {
            id: "next",
            label: "Next",
            icon: <ChevronRight />,
            accent: true,
            disabled: i >= deck.length - 1,
            onClick: () => setI((n) => Math.min(deck.length - 1, n + 1)),
          },
        ]}
      />
    </main>
  );
}

function shortName(d: Matter["docs"][number], matter: Matter) {
  const t = paperTitle(d, matter.columns);
  return t.length > 28 ? t.slice(0, 26) + "…" : t;
}
