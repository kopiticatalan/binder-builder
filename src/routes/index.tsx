import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  Download,
  Folder,
  Gavel,
  Plus,
  Radar,
  Scale,
  Settings,
} from "lucide-react";
import { StatusBar } from "@/components/metro/status-bar";
import { ClockTile, Tile } from "@/components/metro/tile";
import { MetroButton } from "@/components/metro/controls";
import { MatterCard } from "@/components/metro/matter-card";
import { WeekBoard } from "@/components/metro/week-board";
import { ACCENTS, ACCENT_LABELS, type AccentId } from "@/lib/binder/types";
import { allOpenTasks, downloadHearingsIcs, partyCaption } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
import { useCourt } from "@/lib/binder/court-store";
import { runCauselistScan } from "@/lib/binder/scan";
import { useBinder } from "@/lib/binder/store";
import { resolvedListsRoot } from "@/lib/binder/order-files";
import { BHC_DISPLAY_BOARD, BHC_VC_BOARD } from "@/lib/court/links";
import { deskFs, openExternal, openFolder } from "@/lib/court/fs";
import { cn, publicUrl } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: StartHub });

function StartHub() {
  const navigate = useNavigate();
  const ready = useBinder((s) => s.ready);
  const matters = useBinder((s) => s.matters);
  const active = useBinder((s) => s.active());
  const newMatter = useBinder((s) => s.newMatter);
  const loadPractice = useBinder((s) => s.loadPractice);
  const clearSample = useBinder((s) => s.clearSample);
  const setActive = useBinder((s) => s.setActive);
  const accent = useBinder((s) => s.accent);
  const setAccent = useBinder((s) => s.setAccent);
  const toggleTask = useBinder((s) => s.toggleTask);
  const setStatus = useBinder((s) => s.setStatus);
  const stampCaptionFromDocket = useBinder((s) => s.stampCaptionFromDocket);
  const listings = useCourt((s) => s.listings);
  const settings = useCourt((s) => s.settings);
  const tasks = allOpenTasks(matters);
  const hasSample = matters.some((m) => m.sample);

  function startCompilation() {
    const id = newMatter();
    setActive(id);
    void navigate({ to: "/binder" });
  }

  function binderForMatter() {
    if (!active) {
      void navigate({ to: "/matters" });
      return;
    }
    setActive(active.id);
    stampCaptionFromDocket();
    void navigate({ to: "/binder" });
  }

  async function scan() {
    setStatus("Scanning published lists. This can take a minute.", "busy");
    const r = await runCauselistScan(settings.scan_days);
    if (r.ok) setStatus(`Lists updated · ${r.rows} row(s).`, "ok");
    else setStatus(r.error, "err");
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <StatusBar />
      <div className="hub-panorama px-4 pt-6 md:px-10">
        <section className="hub-pane">
          <h1 className="panorama-title">today</h1>
          <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed text-pretty">
            What is listed today, then the next five days. Lists scan on their own while this is open. Display board
            and VC board open in the browser.
          </p>

          <div className="mb-8 flex flex-wrap gap-2">
            <MetroButton variant="accent" onClick={() => void scan()} disabled={listings.scanning}>
              {listings.scanning ? "Scanning…" : "Scan lists"}
            </MetroButton>
            <MetroButton onClick={() => void navigate({ to: "/fetch" })}>Add from court</MetroButton>
            <MetroButton onClick={() => void navigate({ to: "/matters" })}>My matters</MetroButton>
            <MetroButton onClick={() => void navigate({ to: "/listings" })}>All lists</MetroButton>
            <MetroButton
              onClick={() => {
                void openExternal(BHC_DISPLAY_BOARD);
              }}
            >
              Display board
            </MetroButton>
            <MetroButton
              onClick={() => {
                void openExternal(BHC_VC_BOARD);
              }}
            >
              VC board
            </MetroButton>
            <MetroButton
              onClick={() => {
                try {
                  const n = downloadHearingsIcs(matters);
                  setStatus(`Exported ${n} reminder(s). Import into Calendar or Outlook — they sync to the phone.`, "ok");
                } catch (e) {
                  setStatus(e instanceof Error ? e.message : "Nothing to export.", "err");
                }
              }}
            >
              Calendar reminders
            </MetroButton>
            <MetroButton
              onClick={async () => {
                const desk = await deskFs();
                if (!desk.fs) {
                  setStatus("Lists folder is in the Mac app, next to your order folders.", "err");
                  return;
                }
                const r = await openFolder(resolvedListsRoot(settings, desk.defaultRoot));
                if (!r?.ok) setStatus(r?.error || "Could not open lists folder.", "err");
              }}
            >
              Lists folder
            </MetroButton>
          </div>
          {listings.generated_at ? (
            <p className="mb-6 text-xs text-muted">Last scan {listings.generated_at} · {listings.range_label}</p>
          ) : (
            <p className="mb-6 text-xs text-muted">Lists not scanned yet — your diary dates still show below.</p>
          )}

          {!ready ? <p className="text-muted">Loading…</p> : <WeekBoard horizon={5} />}
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">my matters</h2>
          <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
            Every case on this device. Update orders into the folder, open the file, or reveal it in Finder.
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
            <MetroButton onClick={() => void navigate({ to: "/matters" })}>See all</MetroButton>
          </div>
          {matters.length === 0 ? (
            <p className="text-muted">No matters yet.</p>
          ) : (
            <div className="max-w-3xl space-y-3">
              {matters.slice(0, 6).map((m) => (
                <MatterCard key={m.id} matter={m} dense />
              ))}
              {matters.length > 6 ? (
                <MetroButton onClick={() => void navigate({ to: "/matters" })}>
                  All {matters.length} matters
                </MetroButton>
              ) : null}
            </div>
          )}
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">binder</h2>
          <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
            A compilation for a hearing — cover, papers, PDF. Use the open matter’s title, or start a loose one and
            type the caption yourself.
          </p>
          <div className="grid max-w-xl grid-cols-2 gap-3">
            <Tile
              color="cyan"
              wide
              title="This matter"
              live={active ? partyCaption(active) : "Pick a matter first"}
              subtitle="Caption from parties"
              icon={<Scale className="size-7" />}
              onClick={binderForMatter}
            />
            <Tile
              color="steel"
              title="New compilation"
              subtitle="Blank cover, type it yourself"
              icon={<Plus className="size-6" />}
              onClick={startCompilation}
            />
            <Tile
              color="crimson"
              title="Hearing"
              subtitle="Starred authorities, full screen"
              icon={<Gavel className="size-6" />}
              to="/hearing"
            />
          </div>
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">tasks</h2>
          <p className="mb-6 text-sm text-muted">Open next steps. Tap the box to tick; tap the name for the matter.</p>
          {tasks.length === 0 ? (
            <p className="text-muted">No open tasks. Add them on a matter.</p>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {tasks.slice(0, 10).map(({ matter, step }) => {
                const n = daysUntil(step.due);
                return (
                  <li key={step.id} className="flex items-start gap-3 px-4 py-4">
                    <button
                      type="button"
                      className="mt-1 grid size-6 shrink-0 place-items-center border-2 border-fg"
                      aria-label="Mark done"
                      onClick={() => {
                        setActive(matter.id);
                        toggleTask(step.id, true);
                      }}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setActive(matter.id);
                        void navigate({ to: "/docket" });
                      }}
                    >
                      <span className="block font-display text-2xl font-light leading-none">{step.text}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {partyCaption(matter)}
                        {n == null ? "" : ` · ${n === 0 ? "today" : n === 1 ? "tomorrow" : n < 0 ? `${-n} days ago` : `in ${n} days`}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">more</h2>
          <p className="mb-6 text-sm text-muted">Settings, sample files, the Mac app.</p>
          <div className="grid max-w-xl grid-cols-2 gap-3">
            <ClockTile color={accent} />
            <Tile
              color="steel"
              title="Settings"
              subtitle="Folders, firms, backup"
              icon={<Settings className="size-6" />}
              to="/settings"
            />
            <Tile
              color="cobalt"
              wide
              title="Mac app"
              live="Unzip · drag to Applications"
              subtitle="Right-click → Open. Court fetch on your Mac."
              icon={<Download className="size-7" />}
              onClick={() => {
                const a = document.createElement("a");
                a.href = publicUrl("Binder-Builder-for-Mac.zip");
                a.download = "Binder-Builder-for-Mac.zip";
                a.click();
              }}
            />
            <Tile
              color="teal"
              title="How to"
              subtitle="Lists, orders, binder"
              icon={<BookOpen className="size-6" />}
              to="/guide"
            />
            <Tile
              color="emerald"
              title={hasSample ? "Clear sample" : "Sample"}
              subtitle={hasSample ? "Remove the four demo matters" : "Four Bombay HC files"}
              icon={<Folder className="size-6" />}
              onClick={() => {
                if (hasSample) clearSample();
                else loadPractice();
              }}
            />
            <Tile
              color="crimson"
              title="Published lists"
              live={listings.generated_at || "Not scanned"}
              subtitle="Cause lists · add from board"
              icon={<CalendarRange className="size-6" />}
              to="/listings"
            />
            <Tile
              color="cyan"
              title="Add from court"
              subtitle="BHC · SAT · NCLT lookup"
              icon={<Radar className="size-6" />}
              to="/fetch"
            />
          </div>
          <section className="mt-12 max-w-xl">
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
          </section>
        </section>
      </div>
    </main>
  );
}
