import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  CheckSquare,
  Download,
  Folder,
  Gavel,
  LayoutTemplate,
  ListOrdered,
  Play,
  Plus,
  Radar,
  Scale,
  Search,
  Settings,
  Timer,
} from "lucide-react";
import { StatusBar } from "@/components/metro/status-bar";
import { ClockTile, Tile } from "@/components/metro/tile";
import { MetroButton } from "@/components/metro/controls";
import { ACCENTS, ACCENT_LABELS, effectivePages, type AccentId } from "@/lib/binder/types";
import { allOpenTasks, boardRows, dayPhrase, partyCaption } from "@/lib/binder/docket";
import { daysUntil, prettyCourtDay } from "@/lib/binder/dates";
import { useCourt } from "@/lib/binder/court-store";
import { runCauselistScan } from "@/lib/binder/scan";
import { useBinder } from "@/lib/binder/store";
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
  const listings = useCourt((s) => s.listings);
  const settings = useCourt((s) => s.settings);
  const pages = active?.docs.reduce((a, d) => a + effectivePages(d), 0) ?? 0;
  const board = boardRows(matters);
  const todayBoard = board.filter((r) => r.days === 0);
  const soonBoard = board.filter((r) => r.days >= 0 && r.days <= 2);
  const tasks = allOpenTasks(matters);
  const overdue = tasks.filter((t) => {
    const n = daysUntil(t.step.due);
    return n != null && n < 0;
  }).length;
  const hasSample = matters.some((m) => m.sample);
  const today = prettyCourtDay(new Date());
  const listedToday = new Set(
    listings.rows.filter((r) => r.tracked && r.date_full === today.full).map((r) => r.number),
  ).size;
  const trackedRows = listings.rows.filter((r) => r.tracked).slice(0, 8);

  function openDocket(id: string) {
    setActive(id);
    void navigate({ to: "/docket" });
  }

  function startMatter() {
    newMatter();
    void navigate({ to: "/docket" });
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <StatusBar />
      <div className="hub-panorama px-4 pt-6 md:px-10">
        <section className="hub-pane">
          <h1 className="panorama-title">
            today
          </h1>
          <p className="mb-8 max-w-xl text-sm text-muted leading-relaxed text-pretty">
            Add a matter from Bombay High Court, SAT or NCLT. Scan published cause lists. Download orders onto this
            device. The binder is optional — drop PDFs when you need a compilation.
          </p>

          {!ready ? (
            <p className="text-muted">Loading matters…</p>
          ) : (
            <div className="grid max-w-4xl grid-cols-2 gap-3">
              <ClockTile color={accent} />
              <Tile
                color="cyan"
                wide
                title="From court"
                live="BHC · SAT · NCLT"
                subtitle="Find the case, save orders"
                icon={<Radar className="size-7" />}
                to="/fetch"
              />
              <Tile
                color="crimson"
                wide
                title="Board"
                live={
                  listedToday
                    ? `${listedToday} listed today`
                    : todayBoard.length
                      ? `${todayBoard.length} diary’d today`
                      : soonBoard.length
                        ? `${soonBoard.length} in the next two days`
                        : listings.generated_at
                          ? "Nothing of yours listed"
                          : "Scan to see lists"
                }
                subtitle="Live cause lists + diary"
                icon={<CalendarRange className="size-7" />}
                to="/listings"
              />
              <Tile
                color="teal"
                title="Scan lists"
                live={listings.scanning ? "Scanning…" : listings.generated_at ? listings.generated_at : "Not yet"}
                subtitle={`${settings.scan_days}-day horizon`}
                icon={<Radar className="size-6" />}
                onClick={() => {
                  void (async () => {
                    void navigate({ to: "/listings" });
                    const r = await runCauselistScan(settings.scan_days);
                    if (r.ok) setStatus(`Cause lists updated · ${r.rows} row(s).`, "ok");
                    else setStatus(r.error, "err");
                  })();
                }}
              />
              <Tile
                color="steel"
                title="Blank docket"
                subtitle="Any court, typed by hand"
                icon={<Plus className="size-6" />}
                onClick={startMatter}
              />
              <Tile
                color="teal"
                title="Tasks"
                live={`${tasks.length} open`}
                subtitle={overdue ? `${overdue} overdue` : "Next steps across matters"}
                icon={<CheckSquare className="size-6" />}
                to="/tasks"
              />
              <Tile
                color="cobalt"
                wide
                title="Open last"
                live={active ? partyCaption(active) : "No matter yet"}
                subtitle={
                  active
                    ? `${active.config.caseNumber || "No case no."} · ${active.docs.length} papers`
                    : "Fetch or start a matter first"
                }
                icon={<Play className="size-7" />}
                onClick={() => {
                  if (active) void navigate({ to: "/docket" });
                  else void navigate({ to: "/fetch" });
                }}
              />
              <Tile
                color="emerald"
                title="Matters"
                live={`${matters.length}`}
                subtitle="Practice on this device"
                icon={<Folder className="size-6" />}
                to="/matters"
              />
              <Tile
                color="steel"
                title="Settings"
                subtitle="Watch list, backup, alerts"
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
                color="steel"
                title="Binder"
                live={active ? `${pages} pp` : "No papers yet"}
                subtitle="Cover, papers, PDF"
                icon={<Scale className="size-6" />}
                to="/binder"
              />
              <Tile
                color="crimson"
                title="Hearing"
                subtitle="Starred authorities, full screen"
                icon={<Gavel className="size-6" />}
                to="/hearing"
              />
              <Tile
                color="cobalt"
                title="Captions"
                subtitle="Optional court forms"
                icon={<LayoutTemplate className="size-6" />}
                to="/templates"
              />
              <Tile
                color="teal"
                title="How to"
                subtitle="Fetch, scan, compile"
                icon={<BookOpen className="size-6" />}
                to="/guide"
              />
              <Tile
                color="emerald"
                title={hasSample ? "Clear sample" : "Sample practice"}
                subtitle={hasSample ? "Remove the four demo matters" : "Four Bombay HC files to click around"}
                icon={<Folder className="size-6" />}
                onClick={() => {
                  if (hasSample) clearSample();
                  else loadPractice();
                }}
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
          <h2 className="panorama-title">board</h2>
          <p className="mb-6 text-sm text-muted">
            {listings.generated_at
              ? `Last scan ${listings.generated_at}. Your matters on published lists, then diary dates.`
              : "Scan published cause lists, or type a next listing on the docket."}
          </p>
          {trackedRows.length === 0 && soonBoard.length === 0 ? (
            <div className="max-w-md">
              <p className="mb-4 text-muted">Nothing on the board yet.</p>
              <div className="flex flex-wrap gap-2">
                <MetroButton variant="accent" onClick={() => void navigate({ to: "/fetch" })}>
                  From court
                </MetroButton>
                <MetroButton onClick={() => void navigate({ to: "/listings" })}>Scan lists</MetroButton>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {trackedRows.map((r, i) => (
                <li key={`scan-${i}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                    onClick={() => {
                      if (r.mid) openDocket(r.mid);
                      else void navigate({ to: "/listings" });
                    }}
                  >
                    <span className="font-display text-2xl font-light leading-none">{r.matter}</span>
                    <span className="text-xs text-muted">
                      {r.date} · {r.number}
                      {r.list_type ? ` · ${r.list_type}` : ""}
                      {r.judge ? ` · ${r.judge}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {soonBoard
                .filter((r) => !trackedRows.some((t) => t.mid === r.id))
                .map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-1 px-4 py-4 text-left"
                      onClick={() => openDocket(r.id)}
                    >
                      <span className="font-display text-2xl font-light leading-none">{r.name}</span>
                      <span className="text-xs text-muted">
                        {r.caseNumber || "No case number"} · {r.court || "Court not set"} · {dayPhrase(r.days)}
                        {r.stage ? ` · ${r.stage}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">tasks</h2>
          <p className="mb-6 text-sm text-muted">Open next steps. Tap the box to tick; tap the name for the docket.</p>
          {tasks.length === 0 ? (
            <p className="text-muted">No open tasks. Add them on a matter’s docket.</p>
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
                      onClick={() => openDocket(matter.id)}
                    >
                      <span className="block font-display text-2xl font-light leading-none">{step.text}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {partyCaption(matter)}
                        {n == null ? "" : ` · ${dayPhrase(n)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">tools</h2>
          <p className="mb-6 text-sm text-muted">Hearing-day kit. Swipe back for the board.</p>
          <div className="grid grid-cols-2 gap-3">
            <Tile
              color="crimson"
              wide
              title="Hearing"
              live={active ? `${active.docs.filter((d) => d.flagged).length || active.docs.length} in the deck` : "Star papers first"}
              subtitle="Live pages, pinpoints, speaking notes"
              icon={<Gavel className="size-7" />}
              to="/hearing"
            />
            <Tile
              color="teal"
              title="Desk"
              subtitle="Limitation, search, oral note"
              icon={<Timer className="size-6" />}
              to="/desk"
            />
            <Tile
              color="cobalt"
              title="Chronology"
              subtitle="Papers in date order"
              icon={<Search className="size-6" />}
              to="/chrono"
            />
            <Tile
              color="cyan"
              title="Authorities"
              subtitle="Table of authorities"
              icon={<ListOrdered className="size-6" />}
              to="/toa"
            />
            <Tile
              color="steel"
              title="Binder"
              subtitle="Cover, papers, PDF"
              icon={<Scale className="size-6" />}
              to="/binder"
            />
            <Tile
              color="emerald"
              title="Captions"
              subtitle="Optional court forms"
              icon={<LayoutTemplate className="size-6" />}
              to="/templates"
            />
          </div>
        </section>

        <section className="hub-pane">
          <h2 className="panorama-title">matters</h2>
          <p className="mb-6 text-sm text-muted">Swipe from start. Tap a tile to open the docket.</p>
          {matters.length === 0 ? (
            <p className="text-muted">No matters yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {matters.slice(0, 8).map((m, i) => {
                const colors: AccentId[] = ["cyan", "cobalt", "teal", "emerald", "crimson", "steel"];
                const n = daysUntil(m.config.hearingDate);
                return (
                  <Tile
                    key={m.id}
                    color={colors[i % colors.length]}
                    wide={i === 0}
                    title={partyCaption(m)}
                    live={m.config.caseNumber || m.config.court || m.stage || "Open"}
                    subtitle={n == null ? `${m.docs.length} papers` : `${dayPhrase(n)} · ${m.docs.length} papers`}
                    onClick={() => openDocket(m.id)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
