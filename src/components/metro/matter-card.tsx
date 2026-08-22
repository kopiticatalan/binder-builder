import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MetroButton } from "@/components/metro/controls";
import { partyCaption, dayPhrase, nextDate } from "@/lib/binder/docket";
import { daysUntil, fromIsoDate, isoFromCourt } from "@/lib/binder/dates";
import { resolvedOrderFolder } from "@/lib/binder/order-files";
import { ordersSavedMessage, refreshMatter } from "@/lib/binder/orders";
import { useCourt } from "@/lib/binder/court-store";
import { useBinder } from "@/lib/binder/store";
import type { Matter } from "@/lib/binder/types";
import { deskFs, openFolder, type DeskFs } from "@/lib/court/fs";
import { canFetchCourt, caseLabel, cn, forumOf } from "@/lib/utils";

export function MatterCard({ matter, dense = false }: { matter: Matter; dense?: boolean }) {
  const navigate = useNavigate();
  const setActive = useBinder((s) => s.setActive);
  const setStatus = useBinder((s) => s.setStatus);
  const deleteMatter = useBinder((s) => s.deleteMatter);
  const stampCaptionFromDocket = useBinder((s) => s.stampCaptionFromDocket);
  const settings = useCourt((s) => s.settings);
  const [desk, setDesk] = useState<DeskFs | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void deskFs().then(setDesk);
  }, []);

  const yours = matter.config.hearingDate;
  const courtNext = matter.nextListing;
  const courtIso = isoFromCourt(courtNext);
  const n = daysUntil(nextDate(matter));
  const ordersGot = matter.orders.filter((o) => o.downloaded).length;
  const folder = resolvedOrderFolder(matter, settings, desk?.defaultRoot || "~/Desktop/Bombay HC matters");
  const forum =
    forumOf(matter) === "bhc"
      ? matter.sideLabel || "Bombay High Court"
      : forumOf(matter) === "sat"
        ? "SAT"
        : forumOf(matter) === "nclt"
          ? matter.benchLabel
            ? `NCLT · ${matter.benchLabel}`
            : "NCLT"
          : matter.config.court || "Manual";

  function open(to: "/docket" | "/binder" | "/hearing") {
    setActive(matter.id);
    if (to === "/binder" && !matter.config.causeTitle.trim()) stampCaptionFromDocket();
    void navigate({ to });
  }

  async function updateOrders() {
    setBusy(true);
    setStatus("Updating orders from the court record…", "busy");
    const r = await refreshMatter(matter);
    setBusy(false);
    if (!r.ok) setStatus(r.error, "err");
    else setStatus(ordersSavedMessage(r.added, r.folder), "ok");
  }

  async function revealFolder() {
    const r = await openFolder(folder);
    if (!r?.ok) setStatus(r?.error || "Could not open that folder.", "err");
  }

  return (
    <article className={cn("border border-line", dense ? "px-4 py-4" : "px-4 py-5")}>
      <button type="button" className="w-full text-left" onClick={() => open("/docket")}>
        <p className="font-display text-2xl font-light leading-none text-pretty">{partyCaption(matter)}</p>
        <p className="mt-2 text-xs text-muted">
          {caseLabel(matter) || matter.config.caseNumber || "No case number"}
          {` · ${forum}`}
          {matter.stage ? ` · ${matter.stage}` : ""}
          {matter.courtStatus || matter.status ? ` · ${matter.courtStatus || matter.status}` : ""}
        </p>
      </button>

      <div className={cn("mt-4 grid gap-3 text-sm", dense ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        <div>
          <p className="label-caps">Your next date</p>
          <p>
            {yours ? fromIsoDate(yours) : "—"}
            {n != null ? ` · ${dayPhrase(n)}` : ""}
          </p>
        </div>
        <div>
          <p className="label-caps">Court website</p>
          <p className={courtIso && yours && courtIso !== yours ? "text-accent" : undefined}>
            {courtNext || "not on the site"}
          </p>
        </div>
        <div>
          <p className="label-caps">Last date</p>
          <p>{matter.lastListing || matter.courtLastDate || "—"}</p>
        </div>
        {!dense ? (
          <>
            <div>
              <p className="label-caps">Orders</p>
              <p>
                {ordersGot}/{matter.orders.length} downloaded
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="label-caps">Folder</p>
              <p className="truncate font-mono text-xs text-muted" title={folder}>
                {folder}
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MetroButton className="min-h-9 px-3 text-xs" onClick={() => open("/docket")}>
          Open
        </MetroButton>
        {canFetchCourt(matter) ? (
          <MetroButton className="min-h-9 px-3 text-xs" disabled={busy} onClick={() => void updateOrders()}>
            {busy ? "Updating…" : "Update orders"}
          </MetroButton>
        ) : null}
        {desk?.fs ? (
          <MetroButton className="min-h-9 px-3 text-xs" onClick={() => void revealFolder()}>
            Folder
          </MetroButton>
        ) : null}
        <MetroButton className="min-h-9 px-3 text-xs" onClick={() => open("/binder")}>
          Binder
        </MetroButton>
        {!dense ? (
          <MetroButton variant="danger" className="min-h-9 px-3 text-xs" onClick={() => deleteMatter(matter.id)}>
            Remove
          </MetroButton>
        ) : null}
      </div>
    </article>
  );
}
