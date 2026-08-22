import {
  scanBhcDay,
  scanNcltLists,
  scanSatLists,
} from "@/lib/court/client";
import type { ListingRow } from "@/lib/types";
import { isTrackedCaseno } from "@/lib/court/match";
import { deskFs } from "@/lib/court/fs";
import { forumOf, matterCasenos, short } from "@/lib/utils";
import { prettyCourtDay } from "./dates";
import { listDayFolder } from "./order-files";
import { useBinder } from "./store";
import { useCourt } from "./court-store";

function rowKey(r: Pick<ListingRow, "date_full" | "number" | "list_type" | "judge">) {
  return [r.date_full, r.number, r.list_type, r.judge].join("|");
}

export async function runCauselistScan(numDays: number) {
  const matters = useBinder.getState().matters;
  const { settings, mergeListingRows, setListings, setScanProgress, log } = useCourt.getState();
  const prevMine = new Set(
    useCourt.getState().listings.rows.filter((r) => r.tracked).map(rowKey),
  );
  setListings({ scanning: true });
  useBinder.getState().setStatus("Scanning published boards…", "busy");
  const tracked = matters.flatMap(matterCasenos);
  const days = Array.from({ length: numDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return prettyCourtDay(d);
  });
  const allRows: ListingRow[] = [];
  const desk = await deskFs();
  try {
    setScanProgress("SAT cause lists…");
    useBinder.getState().setStatus("SAT cause lists…", "busy");
    const sat = await scanSatLists({
      data: {
        dates: days.map((d) => d.date),
        watched: settings.watched,
        tracked,
      },
    });
    if (sat.ok) {
      for (const hit of sat.hits) {
        const dateKey = hit.href.match(/view-causelist\/(\d{2}-\d{2}-\d{4})/);
        const matchDay = days.find((d) => d.date === (dateKey?.[1] || "")) || days[0];
        const mine = isTrackedCaseno(hit.caseno, tracked) || isTrackedCaseno(`${hit.no}/${hit.year}`, tracked);
        const m = matters.find((x) => isTrackedCaseno(hit.caseno, matterCasenos(x)));
        allRows.push({
          date: matchDay.short,
          date_full: matchDay.full,
          date_ddmm: matchDay.date,
          matter:
            mine && m
              ? `${short(m.petitioner)} v ${short(m.respondent)}`.replace(/^ v | v$/g, "")
              : hit.parties || hit.caseno,
          number: hit.caseno,
          serial: hit.serial,
          list_type: `SAT · ${hit.list_type}`,
          judge: hit.judge,
          court: hit.court,
          caption: hit.caption,
          connected: hit.connected,
          reasons: [...(mine ? ["Your matter"] : []), ...hit.advocates],
          tracked: mine,
          mid: m?.id ?? null,
          source: "sat",
          href: hit.href,
          add: mine
            ? null
            : {
                forum: "sat",
                abbr: hit.type_name,
                stampreg: "R",
                no: hit.no,
                year: hit.year,
              },
        });
      }
      if (sat.hits.length) mergeListingRows(allRows, days, numDays, matters);
    }

    setScanProgress("NCLT cause lists…");
    useBinder.getState().setStatus("NCLT cause lists…", "busy");
    const ncltBenches = [
      ...new Set(["9", ...matters.filter((m) => forumOf(m) === "nclt").map((m) => m.bench || "9")]),
    ];
    const nclt = await scanNcltLists({
      data: {
        dates: days.map((d) => d.date),
        watched: settings.watched,
        tracked,
        benches: ncltBenches,
      },
    });
    if (nclt.ok) {
      for (const hit of nclt.hits) {
        const dmy = (hit.href.match(/(\d{2})[./-](\d{2})[./-](\d{4})/) || []).slice(1);
        const ddmm = dmy.length === 3 ? `${dmy[0]}-${dmy[1]}-${dmy[2]}` : "";
        const matchDay = days.find((d) => d.date === ddmm) || days[0];
        const mine = isTrackedCaseno(hit.caseno, tracked) || isTrackedCaseno(`${hit.no}/${hit.year}`, tracked);
        const m = matters.find((x) => isTrackedCaseno(hit.caseno, matterCasenos(x)) || isTrackedCaseno(`${hit.no}/${hit.year}`, matterCasenos(x)));
        allRows.push({
          date: matchDay.short,
          date_full: matchDay.full,
          date_ddmm: matchDay.date,
          matter:
            mine && m
              ? `${short(m.petitioner)} v ${short(m.respondent)}`.replace(/^ v | v$/g, "")
              : hit.parties || hit.caseno,
          number: hit.caseno,
          serial: hit.serial,
          list_type: `NCLT · ${hit.court || hit.list_type}`,
          judge: hit.judge,
          court: hit.court,
          caption: hit.caption,
          connected: hit.connected,
          reasons: [...(mine ? ["Your matter"] : []), ...hit.advocates],
          tracked: Boolean(mine),
          mid: m?.id ?? null,
          source: "nclt",
          href: hit.href,
          add: mine
            ? null
            : {
                forum: "nclt",
                abbr: hit.type_name,
                stampreg: "R",
                no: hit.no,
                year: hit.year,
                bench: hit.bench || "9",
              },
        });
      }
      if (nclt.hits.length) mergeListingRows(allRows, days, numDays, matters);
    }

    let listsSaved = 0;
    for (const day of days) {
      setScanProgress(`Boards for ${day.short}…`);
      useBinder.getState().setStatus(`Bombay HC boards for ${day.short}…`, "busy");
      const listFolder = desk.fs ? listDayFolder(settings, desk.defaultRoot, day.date) : "";
      const scanned = await scanBhcDay({
        data: {
          date: day.date,
          watched: settings.watched,
          tracked,
          list_folder: listFolder || undefined,
        },
      });
      if (!scanned.ok) {
        setScanProgress(scanned.error);
        continue;
      }
      listsSaved += (scanned.pdfs || []).length;
      for (const hit of scanned.hits) {
        const mine = isTrackedCaseno(hit.caseno, tracked);
        const m = matters.find((x) => isTrackedCaseno(hit.caseno, matterCasenos(x)));
        const mm = hit.caseno.match(/^([A-Z]+)(\(L\))?\/(\d+)\/(\d{4})$/i);
        if (m && hit.connected) {
          useBinder.getState().patchMatter(
            m.id,
            (x) => {
              x.connected = hit.connected;
            },
            { undo: false },
          );
        }
        allRows.push({
          date: day.short,
          date_full: day.full,
          date_ddmm: day.date,
          matter:
            mine && m
              ? `${short(m.petitioner)} v ${short(m.respondent)}`.replace(/^ v | v$/g, "")
              : hit.parties || hit.caseno,
          number: hit.caseno,
          serial: hit.serial,
          list_type: hit.list_type,
          judge: hit.judge,
          court: hit.court,
          caption: hit.caption,
          connected: hit.connected,
          reasons: [...(mine ? ["Your matter"] : []), ...hit.advocates],
          tracked: mine,
          mid: m?.id ?? null,
          vc: hit.vc,
          listFile: hit.listFile,
          listPath: hit.listPath,
          add:
            mine || !mm
              ? null
              : {
                  forum: "bhc",
                  abbr: mm[1],
                  stampreg: mm[2] ? "S" : "R",
                  no: mm[3],
                  year: mm[4],
                },
        });
      }
      mergeListingRows(allRows, days, numDays, matters);
    }
    mergeListingRows(allRows, days, numDays, matters);
    const mine = allRows.filter((r) => r.tracked).length;
    const fresh = allRows.filter((r) => r.tracked && !prevMine.has(rowKey(r)));
    log("scan", "Cause lists updated", `${mine} of your matters listed`);
    const extra = listsSaved ? ` · ${listsSaved} list PDF(s) saved` : "";
    useBinder.getState().setStatus(
      mine ? `${mine} of your matters on the board${extra}.` : `Scan finished. None of yours listed${extra}.`,
      "ok",
    );
    if (settings.notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const today = prettyCourtDay(new Date());
      const nToday = new Set(
        allRows.filter((r) => r.tracked && r.date_full === today.full).map((r) => r.number),
      ).size;
      if (fresh.length && prevMine.size) {
        new Notification("Lists updated", {
          body: `${fresh.length} newly listed. Supplementary or a late board.`,
        });
      } else if (nToday) {
        new Notification("Matters on board", {
          body: `${nToday} of your matters listed today.`,
        });
      }
    }
    return { ok: true as const, rows: allRows.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Scan failed.";
    useBinder.getState().setStatus(error, "err");
    return { ok: false as const, error };
  } finally {
    setListings({ scanning: false });
    setScanProgress("");
  }
}

export async function requestNotify() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
