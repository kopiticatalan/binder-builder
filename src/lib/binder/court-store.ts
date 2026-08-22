import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityEvent, ListingRow, ListingsState, TrackerSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { clockNow } from "./dates";
import { matterCasenos, uid } from "@/lib/utils";
import type { Matter } from "./types";

function emptyListings(): ListingsState {
  return {
    generated_at: "",
    days: [],
    range_label: "",
    num_days: 5,
    rows: [],
    scanning: false,
  };
}

export function annotateListings(rows: ListingRow[], matters: Matter[]): ListingRow[] {
  const byNo = new Map<string, Matter>();
  for (const m of matters) {
    for (const cn of matterCasenos(m)) byNo.set(cn.toUpperCase(), m);
  }
  return rows.map((row) => {
    const m = byNo.get((row.number || "").toUpperCase());
    const reasons = (row.reasons || []).filter((r) => r !== "Your matter");
    if (m) {
      return {
        ...row,
        tracked: true,
        add: null,
        reasons: ["Your matter", ...reasons],
        mid: m.id,
        matter:
          `${m.petitioner || ""} v ${m.respondent || ""}`.trim().replace(/^v | v$/g, "") ||
          row.matter,
      };
    }
    const mm = (row.number || "").match(/^([A-Z]+)(\(L\))?\/(\d+)\/(\d{4})$/i);
    return {
      ...row,
      tracked: false,
      mid: null,
      reasons,
      add:
        row.source === "sat" || row.source === "nclt"
          ? row.add
          : mm
            ? {
                forum: "bhc" as const,
                abbr: mm[1],
                stampreg: mm[2] ? "S" : "R",
                no: mm[3],
                year: mm[4],
              }
            : row.add,
    };
  });
}

type CourtState = {
  settings: TrackerSettings;
  listings: ListingsState;
  activity: ActivityEvent[];
  scanProgress: string;
  hydrated: boolean;
  setHydrated: () => void;
  setSettings: (s: Partial<TrackerSettings>) => void;
  setListings: (l: Partial<ListingsState>) => void;
  setScanProgress: (s: string) => void;
  mergeListingRows: (rows: ListingRow[], days: ListingsState["days"], numDays: number, matters: Matter[]) => void;
  reannotate: (matters: Matter[]) => void;
  log: (kind: ActivityEvent["kind"], title: string, detail?: string) => void;
};

export const useCourt = create<CourtState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      listings: emptyListings(),
      activity: [],
      scanProgress: "",
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      setListings: (l) => set({ listings: { ...get().listings, ...l } }),
      setScanProgress: (scanProgress) => set({ scanProgress }),
      mergeListingRows: (rows, days, numDays, matters) => {
        const prev = get().listings.rows;
        const map = new Map<string, ListingRow>();
        for (const r of prev) {
          map.set([r.date_full, r.judge, r.court, r.serial, r.number].join("|"), r);
        }
        for (const r of rows) {
          map.set([r.date_full, r.judge, r.court, r.serial, r.number].join("|"), r);
        }
        const merged = annotateListings([...map.values()], matters).sort((a, b) => {
          const da = Date.parse(a.date_full) || 0;
          const db = Date.parse(b.date_full) || 0;
          if (da !== db) return da - db;
          const ca = Number(a.court) || 9999;
          const cb = Number(b.court) || 9999;
          if (ca !== cb) return ca - cb;
          return (Number(a.serial) || 9999) - (Number(b.serial) || 9999);
        });
        const label = days.length ? `${days[0].short} – ${days[days.length - 1].short}` : "";
        set({
          listings: {
            generated_at: clockNow(),
            days,
            range_label: label,
            num_days: numDays,
            rows: merged,
            scanning: false,
          },
        });
      },
      reannotate: (matters) => {
        const listings = get().listings;
        set({
          listings: {
            ...listings,
            rows: annotateListings(listings.rows, matters),
          },
        });
      },
      log: (kind, title, detail) => {
        const ev: ActivityEvent = { id: uid(), at: clockNow(), kind, title, detail };
        set({ activity: [ev, ...get().activity].slice(0, 60) });
      },
    }),
    {
      name: "bb-court-v1",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<CourtState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) },
          listings: p.listings
            ? { ...p.listings, scanning: false }
            : current.listings,
        };
      },
      partialize: (s) => ({
        settings: s.settings,
        listings: { ...s.listings, scanning: false },
        activity: s.activity,
      }),
    },
  ),
);
