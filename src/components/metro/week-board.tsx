import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MetroButton } from "@/components/metro/controls";
import { matterFromLookup } from "@/lib/binder/court-map";
import { useCourt } from "@/lib/binder/court-store";
import { addDays, daysUntil, prettyCourtDay } from "@/lib/binder/dates";
import { nextDate, partyCaption } from "@/lib/binder/docket";
import { resolvedOrderFolder } from "@/lib/binder/order-files";
import { ordersSavedMessage, pullMissingOrders, refreshMatter } from "@/lib/binder/orders";
import { useBinder } from "@/lib/binder/store";
import { courtFailMessage } from "@/lib/court/local";
import { resolveListing } from "@/lib/court/client";
import { deskFs, openFolder, type DeskFs } from "@/lib/court/fs";
import type { ListingRow } from "@/lib/types";
import { canFetchCourt, cn } from "@/lib/utils";

type DayGroup = {
  key: string;
  label: string;
  full: string;
  days: number;
};

export function WeekBoard({ horizon = 5 }: { horizon?: number }) {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const setActive = useBinder((s) => s.setActive);
  const setStatus = useBinder((s) => s.setStatus);
  const upsertMatter = useBinder((s) => s.upsertMatter);
  const listings = useCourt((s) => s.listings);
  const settings = useCourt((s) => s.settings);
  const log = useCourt((s) => s.log);
  const [desk, setDesk] = useState<DeskFs | null>(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    void deskFs().then(setDesk);
  }, []);

  const days = useMemo(() => {
    const out: DayGroup[] = [];
    const now = new Date();
    for (let i = 0; i <= horizon; i++) {
      const p = prettyCourtDay(addDays(now, i));
      out.push({
        key: p.full,
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : p.short,
        full: p.full,
        days: i,
      });
    }
    return out;
  }, [horizon]);

  function openMatter(id: string) {
    setActive(id);
    void navigate({ to: "/docket" });
  }

  async function addFromList(r: ListingRow) {
    if (!r.add) return;
    const key = `${r.date_full}|${r.number}`;
    setBusyId(key);
    setStatus("Adding that case to my matters…", "busy");
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
      setStatus(ordersSavedMessage(pulled.added, pulled.folder), "ok");
    } catch (e) {
      setStatus(courtFailMessage(e), "err");
    } finally {
      setBusyId("");
    }
  }

  async function updateOne(id: string) {
    const m = matters.find((x) => x.id === id);
    if (!m) return;
    setBusyId(`up|${id}`);
    setStatus("Updating orders…", "busy");
    const r = await refreshMatter(m);
    setBusyId("");
    if (!r.ok) setStatus(r.error, "err");
    else setStatus(ordersSavedMessage(r.added, r.folder), "ok");
  }

  async function reveal(id: string) {
    const m = matters.find((x) => x.id === id);
    if (!m) return;
    const folder = resolvedOrderFolder(m, settings, desk?.defaultRoot || "~/Desktop/Bombay HC matters");
    const r = await openFolder(folder);
    if (!r?.ok) setStatus(r?.error || "Could not open that folder.", "err");
  }

  return (
    <div className="max-w-3xl space-y-10">
      {days.map((day) => {
        const mine = matters.filter((m) => {
          const n = daysUntil(nextDate(m));
          return n === day.days;
        });
        const listed = listings.rows.filter((r) => r.date_full === day.full);
        const watch = listed.filter((r) => !r.tracked && !mine.some((m) => m.id === r.mid));
        const listedMine = listed.filter((r) => r.tracked);
        if (!mine.length && !watch.length && !listedMine.length) {
          if (day.days !== 0) return null;
          return (
            <section key={day.key}>
              <p className="label-caps mb-2">{day.label}</p>
              <p className="text-sm text-muted">Nothing of yours today. Scan lists or add a next date on the file.</p>
            </section>
          );
        }
        return (
          <section key={day.key}>
            <p className="label-caps mb-3">
              {day.label}
              <span className="ml-2 font-sans font-normal normal-case tracking-normal text-muted">{day.full}</span>
            </p>
            <ul className="divide-y divide-line border border-line">
              {mine.map((m) => {
                const hit = listed.find((r) => r.mid === m.id);
                return (
                  <li key={m.id} className="px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">My matter</p>
                    <p className="mt-1 font-display text-2xl font-light leading-none">{partyCaption(m)}</p>
                    <p className="mt-2 text-xs text-muted">
                      {m.config.caseNumber || "No case number"}
                      {m.config.court ? ` · ${m.config.court}` : ""}
                      {m.stage ? ` · ${m.stage}` : ""}
                      {hit?.court ? ` · Court ${hit.court}` : ""}
                      {hit?.judge ? ` · ${hit.judge}` : ""}
                      {hit?.serial ? ` · Sr. ${hit.serial}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetroButton className="min-h-9 px-3 text-xs" onClick={() => openMatter(m.id)}>
                        Open
                      </MetroButton>
                      {canFetchCourt(m) ? (
                        <MetroButton
                          className="min-h-9 px-3 text-xs"
                          disabled={busyId === `up|${m.id}`}
                          onClick={() => void updateOne(m.id)}
                        >
                          {busyId === `up|${m.id}` ? "…" : "Update orders"}
                        </MetroButton>
                      ) : null}
                      {desk?.fs ? (
                        <MetroButton className="min-h-9 px-3 text-xs" onClick={() => void reveal(m.id)}>
                          Folder
                        </MetroButton>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {listedMine
                .filter((r) => r.mid && !mine.some((m) => m.id === r.mid))
                .map((r) => (
                  <li key={`lm-${r.date_full}-${r.number}`} className="px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">On the board</p>
                    <p className="mt-1 font-display text-2xl font-light leading-none">{r.matter}</p>
                    <p className="mt-2 text-xs text-muted">
                      {r.number}
                      {r.court ? ` · Court ${r.court}` : ""}
                      {r.judge ? ` · ${r.judge}` : ""}
                    </p>
                    {r.mid ? (
                      <div className="mt-3">
                        <MetroButton className="min-h-9 px-3 text-xs" onClick={() => openMatter(r.mid!)}>
                          Open
                        </MetroButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              {watch.map((r, i) => {
                const key = `${r.date_full}|${r.number}`;
                return (
                  <li key={`w-${key}-${i}`} className="px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {(r.reasons || []).filter((z) => z !== "Your matter")[0] || "Cause list"}
                    </p>
                    <p className="mt-1 font-display text-2xl font-light leading-none">{r.matter}</p>
                    <p className="mt-2 text-xs text-muted">
                      {r.number}
                      {r.court ? ` · Court ${r.court}` : ""}
                      {r.list_type ? ` · ${r.list_type}` : ""}
                      {r.judge ? ` · ${r.judge}` : ""}
                    </p>
                    {r.add ? (
                      <div className="mt-3">
                        <MetroButton
                          variant="accent"
                          className="min-h-9 px-3 text-xs"
                          disabled={busyId === key}
                          onClick={() => void addFromList(r)}
                        >
                          {busyId === key ? "Adding…" : "Add to my matters"}
                        </MetroButton>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {(() => {
        const later = matters.filter((m) => {
          const n = daysUntil(nextDate(m));
          return n != null && n > horizon;
        });
        const none = matters.filter((m) => !nextDate(m) && m.status !== "Disposed");
        if (!later.length && !none.length) return null;
        return (
          <>
            {later.length ? (
              <section>
                <p className="label-caps mb-3">Later</p>
                <ul className="divide-y divide-line border border-line">
                  {later.map((m) => (
                    <li key={m.id} className="px-4 py-4">
                      <button type="button" className="w-full text-left" onClick={() => openMatter(m.id)}>
                        <p className="font-display text-2xl font-light leading-none">{partyCaption(m)}</p>
                        <p className="mt-2 text-xs text-muted">
                          {m.config.caseNumber || "No case number"} · {m.config.hearingDate || m.nextListing}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {none.length ? (
              <section>
                <p className="label-caps mb-3">No next date</p>
                <p className="mb-3 text-sm text-muted">On the file — the court site has nothing, or it was never typed.</p>
                <ul className="divide-y divide-line border border-line">
                  {none.map((m) => (
                    <li key={m.id} className="px-4 py-4">
                      <button type="button" className="w-full text-left" onClick={() => openMatter(m.id)}>
                        <p className="font-display text-2xl font-light leading-none">{partyCaption(m)}</p>
                        <p className="mt-2 text-xs text-muted">{m.config.caseNumber || "No case number"}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        );
      })()}
    </div>
  );
}

export function EmptyWeekHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted", className)}>
      Nothing in the next few days. Add a matter from court, or scan published lists.
    </p>
  );
}
