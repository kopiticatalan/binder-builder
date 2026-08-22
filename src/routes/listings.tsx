import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MetroButton, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { Pivot } from "@/components/metro/pivot";
import { downloadCauselistPdf, resolveListing } from "@/lib/court/client";
import { courtFailMessage } from "@/lib/court/local";
import { matterFromLookup } from "@/lib/binder/court-map";
import { useCourt } from "@/lib/binder/court-store";
import { boardRows, dayPhrase, downloadHearingsIcs } from "@/lib/binder/docket";
import { pullMissingOrders } from "@/lib/binder/orders";
import { runCauselistScan } from "@/lib/binder/scan";
import { useBinder } from "@/lib/binder/store";
import type { ListingRow } from "@/lib/types";
import { downloadBlob, cn } from "@/lib/utils";

export const Route = createFileRoute("/listings")({ component: ListingsPage });

function ListingsPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const setActive = useBinder((s) => s.setActive);
  const setStatus = useBinder((s) => s.setStatus);
  const status = useBinder((s) => s.status);
  const statusKind = useBinder((s) => s.statusKind);
  const upsertMatter = useBinder((s) => s.upsertMatter);
  const listings = useCourt((s) => s.listings);
  const settings = useCourt((s) => s.settings);
  const setSettings = useCourt((s) => s.setSettings);
  const scanProgress = useCourt((s) => s.scanProgress);
  const log = useCourt((s) => s.log);
  const [pane, setPane] = useState<"lists" | "diary">("lists");
  const [filter, setFilter] = useState<"all" | "mine" | "watch">("all");
  const [busyId, setBusyId] = useState("");

  const rows = listings.rows.filter((r) => {
    if (filter === "mine") return r.tracked;
    if (filter === "watch") return !r.tracked;
    return true;
  });
  const mine = listings.rows.filter((r) => r.tracked).length;
  const diary = boardRows(matters);
  const upcoming = diary.filter((r) => r.days >= 0);
  const past = diary.filter((r) => r.days < 0);

  async function scan() {
    setStatus("Scanning published boards. This can take a minute.", "busy");
    const r = await runCauselistScan(settings.scan_days);
    if (r.ok) setStatus(`Cause lists updated · ${r.rows} row(s).`, "ok");
    else setStatus(r.error, "err");
  }

  async function addFromList(r: ListingRow) {
    if (!r.add) return;
    const key = `${r.date_full}|${r.number}`;
    setBusyId(key);
    setStatus("Finding and adding the matter…", "busy");
    try {
      const out = await resolveListing({ data: r.add });
      if (!out.ok) {
        setStatus(out.error, "err");
        return;
      }
      const matter = matterFromLookup({ ...out.params, type_name: out.type_name }, out.lookup);
      upsertMatter(matter);
      log("add", `${matter.petitioner} v ${matter.respondent}`, "From cause list");
      setStatus("Matter added. Downloading orders…", "busy");
      const pulled = await pullMissingOrders(matter);
      setStatus(`${pulled.added} order(s) downloaded.`, "ok");
    } catch (e) {
      setStatus(courtFailMessage(e), "err");
    } finally {
      setBusyId("");
    }
  }

  async function saveListPdf(r: ListingRow) {
    const key = `pdf|${r.date_full}|${r.number}`;
    setBusyId(key);
    setStatus("Fetching cause-list PDF…", "busy");
    try {
      const out = await downloadCauselistPdf({
        data: { date: r.date_ddmm, judge: r.judge, list_type: r.list_type },
      });
      if (!out.ok || !out.file) {
        setStatus(out.ok ? "Missing file" : out.error, "err");
        return;
      }
      const bin = Uint8Array.from(atob(out.file.base64), (c) => c.charCodeAt(0));
      downloadBlob(new Blob([bin], { type: "application/pdf" }), out.file.filename);
      setStatus("Cause-list PDF downloaded.", "ok");
    } catch (e) {
      setStatus(courtFailMessage(e), "err");
    } finally {
      setBusyId("");
    }
  }

  return (
    <PageShell
      title="board"
      backTo="/"
      backLabel="start"
      kicker={
        listings.scanning || scanProgress ? (
          <p className="mt-2 text-sm text-accent">{scanProgress || "Scanning…"}</p>
        ) : listings.generated_at ? (
          <p className="mt-2 text-sm text-muted">
            {listings.range_label || "Range"} · last scanned {listings.generated_at}
          </p>
        ) : null
      }
    >
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed text-pretty">
        Scan published Bombay High Court, SAT and NCLT cause lists, then add a listed case into your practice. Diary is
        the next-listing date on each docket — including dates the court site returned.
      </p>
      {status && statusKind !== "idle" ? (
        <p
          className={
            statusKind === "err"
              ? "mb-6 max-w-xl text-sm text-err"
              : statusKind === "ok"
                ? "mb-6 max-w-xl text-sm text-ok"
                : "mb-6 max-w-xl text-sm text-accent"
          }
        >
          {status}
        </p>
      ) : null}

      <div className="mb-6">
        <Pivot
          tabs={[
            { id: "lists", label: "Cause lists" },
            { id: "diary", label: "Diary" },
          ]}
          value={pane}
          onChange={setPane}
        />
      </div>

      {pane === "lists" ? (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-2">
            <MetroSelect
              className="w-auto"
              value={String(settings.scan_days)}
              onChange={(e) => setSettings({ scan_days: Number(e.target.value) })}
            >
              {[3, 5, 7, 10, 14].map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </MetroSelect>
            <MetroButton variant="accent" disabled={listings.scanning} onClick={() => void scan()}>
              {listings.scanning ? "Scanning…" : "Scan lists"}
            </MetroButton>
            <MetroButton onClick={() => void navigate({ to: "/fetch" })}>From court</MetroButton>
            <MetroButton onClick={() => void navigate({ to: "/settings" })}>Watch list</MetroButton>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              {listings.scanning
                ? "Scan running. Rows appear as each court day finishes."
                : rows.length
                  ? `${mine} of your matters on the board.`
                  : "No results yet. Tap Scan lists."}
            </p>
            <div className="ml-auto flex gap-1 bg-chrome p-1">
              {(["all", "mine", "watch"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
                    filter === k ? "bg-accent text-accent-fg" : "text-muted",
                  )}
                >
                  {k === "all" ? "All" : k === "mine" ? "Mine" : "Watch"}
                </button>
              ))}
            </div>
          </div>

          {!rows.length ? (
            <p className="text-muted">No listings to display.</p>
          ) : (
            <ul className="max-w-3xl divide-y divide-line border border-line">
              {rows.map((r, i) => {
                const key = `${r.date_full}|${r.number}|${i}`;
                const addBusy = busyId === `${r.date_full}|${r.number}`;
                const pdfBusy = busyId === `pdf|${r.date_full}|${r.number}`;
                return (
                  <li key={key} className="px-4 py-4">
                    <p className="text-xs text-accent uppercase tracking-wider">
                      {r.date}
                      {r.court ? ` · Court ${r.court}` : ""}
                    </p>
                    <p className="mt-1 font-display text-2xl font-light leading-none">{r.matter}</p>
                    <p className="mt-2 text-xs text-muted">
                      {r.number}
                      {r.source === "sat" ? " · SAT" : r.source === "nclt" ? " · NCLT" : ""}
                      {r.serial ? ` · Sr. ${r.serial}` : ""}
                      {r.list_type ? ` · ${r.list_type}` : ""}
                      {r.judge ? ` · ${r.judge}` : ""}
                      {r.connected ? ` · with ${r.connected}` : ""}
                    </p>
                    {(r.reasons || []).length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(r.reasons || []).map((z) => (
                          <span
                            key={z}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              z === "Your matter" ? "bg-accent text-accent-fg" : "bg-chrome text-muted",
                            )}
                          >
                            {z}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.tracked && r.mid ? (
                        <MetroButton
                          className="min-h-9 px-3 text-xs"
                          onClick={() => {
                            setActive(r.mid!);
                            void navigate({ to: "/docket" });
                          }}
                        >
                          Open
                        </MetroButton>
                      ) : r.add ? (
                        <MetroButton
                          variant="accent"
                          className="min-h-9 px-3 text-xs"
                          disabled={addBusy}
                          onClick={() => void addFromList(r)}
                        >
                          {addBusy ? "Adding…" : "Add to practice"}
                        </MetroButton>
                      ) : null}
                      {(r.source === "sat" || r.source === "nclt") && r.href ? (
                        <a
                          href={r.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center bg-chrome px-3 text-xs font-semibold uppercase tracking-wider"
                        >
                          List
                        </a>
                      ) : (
                        <MetroButton
                          className="min-h-9 px-3 text-xs"
                          disabled={pdfBusy}
                          onClick={() => void saveListPdf(r)}
                        >
                          {pdfBusy ? "…" : "List PDF"}
                        </MetroButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap gap-2">
            <MetroButton variant="accent" onClick={() => void navigate({ to: "/fetch" })}>
              From court
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
            <p className="mb-10 text-muted">Nothing upcoming. Fetch a matter or type a next listing on the docket.</p>
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
        </>
      )}
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
