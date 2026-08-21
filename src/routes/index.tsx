import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  Folder,
  Gavel,
  LayoutTemplate,
  Play,
  Plus,
  Printer,
  Scale,
  Search,
  Timer,
} from "lucide-react";
import { StatusBar } from "@/components/metro/status-bar";
import { ClockTile, Tile } from "@/components/metro/tile";
import { ACCENTS, ACCENT_LABELS, effectivePages, type AccentId } from "@/lib/binder/types";
import { daysUntil } from "@/lib/binder/dates";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: StartHub });

function StartHub() {
  const navigate = useNavigate();
  const ready = useBinder((s) => s.ready);
  const matters = useBinder((s) => s.matters);
  const active = useBinder((s) => s.active());
  const newMatter = useBinder((s) => s.newMatter);
  const loadSamples = useBinder((s) => s.loadSamples);
  const setActive = useBinder((s) => s.setActive);
  const accent = useBinder((s) => s.accent);
  const setAccent = useBinder((s) => s.setAccent);
  const pages = active?.docs.reduce((a, d) => a + effectivePages(d), 0) ?? 0;
  const starred = active?.docs.filter((d) => d.flagged).length ?? 0;
  const upcoming = matters
    .flatMap((m) =>
      (m.deadlines ?? []).map((d) => ({
        matter: m.name,
        label: d.label,
        date: d.date,
        days: daysUntil(d.date),
        id: m.id,
      })),
    )
    .filter((d) => d.days != null)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    .slice(0, 8);

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <StatusBar />
      <div className="hub-panorama px-4 pt-6 md:px-10">
        <section className="hub-pane">
          <h1 className="panorama-title">
            binder
            <br />
            builder
          </h1>
          <p className="mb-8 max-w-xl text-sm text-muted leading-relaxed text-pretty">
            Cause title, index, merged PDFs, pagination and bookmarks. Everything stays on this device.
          </p>

          {!ready ? (
            <p className="text-muted">Loading matters…</p>
          ) : (
            <div className="grid max-w-4xl grid-cols-2 gap-3">
              <ClockTile color={accent} />
              <Tile
                color="cyan"
                wide
                title="New binder"
                subtitle="Start from an NCLT caption"
                icon={<Plus className="size-7" />}
                onClick={() => {
                  newMatter("nclt-compilation");
                  void navigate({ to: "/binder" });
                }}
              />
              <Tile
                color="cobalt"
                wide
                title="Open last"
                live={active ? `${active.docs.length} papers · ${pages} pp` : "No matter yet"}
                subtitle={active?.name}
                icon={<Play className="size-7" />}
                to="/binder"
              />
              <Tile
                color="teal"
                title="Matters"
                live={`${matters.length}`}
                subtitle="Saved on this device"
                icon={<Folder className="size-6" />}
                to="/matters"
              />
              <Tile
                color="emerald"
                title="Templates"
                subtitle="NCLT, SLP, writ, trial"
                icon={<LayoutTemplate className="size-6" />}
                to="/templates"
              />
              <Tile
                color="crimson"
                title="Hearing"
                live={starred ? `${starred} starred` : "Star papers first"}
                subtitle="Swipe authorities in court"
                icon={<Gavel className="size-6" />}
                to="/hearing"
              />
              <Tile
                color="steel"
                title="Chronology"
                subtitle="Date-order the papers"
                icon={<CalendarRange className="size-6" />}
                to="/chrono"
              />
              <Tile
                color="cyan"
                title="Desk"
                subtitle="Limitation, search, print"
                icon={<Timer className="size-6" />}
                to="/desk"
              />
              <Tile
                color="cobalt"
                title="Search"
                subtitle="Full text of loaded PDFs"
                icon={<Search className="size-6" />}
                to="/desk"
              />
              <Tile
                color="teal"
                title="Sample"
                subtitle="Three IBC authorities"
                icon={<Scale className="size-6" />}
                onClick={() => {
                  void loadSamples().then(() => navigate({ to: "/binder" }));
                }}
              />
              <Tile
                color="emerald"
                title="How to"
                subtitle="Caption marks, volumes"
                icon={<BookOpen className="size-6" />}
                to="/guide"
              />
              <Tile
                color="crimson"
                title="Spine"
                subtitle="Cut-out labels for the file"
                icon={<Printer className="size-6" />}
                to="/binder"
              />
              <Tile
                color="steel"
                title="Build"
                subtitle="PDF · Word · checklist"
                icon={<Play className="size-6" />}
                to="/binder"
              />
            </div>
          )}

          <section className="mt-12 max-w-4xl">
            <p className="label-caps mb-3">Accent</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={ACCENT_LABELS[id]}
                  onClick={() => setAccent(id)}
                  className={cn(
                    "accent-chip",
                    id === "cyan" && "bg-tile-cyan",
                    id === "cobalt" && "bg-tile-cobalt",
                    id === "teal" && "bg-tile-teal",
                    id === "emerald" && "bg-tile-emerald",
                    id === "crimson" && "bg-tile-crimson",
                    id === "steel" && "bg-tile-steel",
                  )}
                  data-on={accent === id}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{ACCENT_LABELS[accent]} — pivots, checks and primary actions.</p>
          </section>
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">matters</h2>
          <p className="mb-6 text-sm text-muted">Swipe from start. Tap a tile to reopen.</p>
          <div className="grid grid-cols-2 gap-3">
            {matters.slice(0, 8).map((m, i) => {
              const pp = m.docs.reduce((a, d) => a + effectivePages(d), 0);
              const colors: AccentId[] = ["cyan", "cobalt", "teal", "emerald", "crimson", "steel"];
              return (
                <Tile
                  key={m.id}
                  color={colors[i % colors.length]}
                  wide={i === 0}
                  title={m.name}
                  live={`${m.docs.length} papers · ${pp} pp`}
                  subtitle={m.config.caseNumber || m.config.court || "Open"}
                  onClick={() => {
                    setActive(m.id);
                    void navigate({ to: "/binder" });
                  }}
                />
              );
            })}
          </div>
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">listing</h2>
          <p className="mb-6 text-sm text-muted">Limitation and next dates across matters on this device.</p>
          {upcoming.length === 0 ? (
            <p className="text-muted">No deadlines yet. Add them on Desk.</p>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {upcoming.map((d) => (
                <li key={d.id + d.label + d.date}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                    onClick={() => {
                      setActive(d.id);
                      void navigate({ to: "/desk" });
                    }}
                  >
                    <span className="font-display text-2xl font-light leading-none">{d.label}</span>
                    <span className="text-xs text-muted">
                      {d.matter} · {d.date} · {d.days === 0 ? "today" : d.days! < 0 ? `${-d.days!} days ago` : `${d.days} days`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
