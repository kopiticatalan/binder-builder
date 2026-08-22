import { resolveListing } from "@/lib/court/client";
import type { ListingRow } from "@/lib/types";
import { isTrackedCaseno } from "@/lib/court/match";
import { matterCasenos } from "@/lib/utils";
import { matterFromLookup } from "./court-map";
import { pullMissingOrders } from "./orders";
import { useBinder } from "./store";
import { useCourt } from "./court-store";
import type { Matter, OrderMeta } from "./types";

export function parseConnected(s: string): string[] {
  return (s || "")
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function addPayloadFromCaseno(caseno: string): ListingRow["add"] | null {
  const mm = caseno.match(/^([A-Z]+)(\(L\))?\/(\d+)\/(\d{4})$/i);
  if (!mm) return null;
  return {
    forum: "bhc",
    abbr: mm[1],
    stampreg: mm[2] ? "S" : "R",
    no: mm[3],
    year: mm[4],
  };
}

export function listingForMatter(matterId: string, rows: ListingRow[]) {
  return rows.find((r) => r.mid === matterId) || rows.find((r) => r.tracked && r.mid === matterId);
}

function stamp(o: OrderMeta) {
  const date = (o.date || "").trim();
  const title = (o.title || o.doc || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${date}|${title}`;
}

export function relatedMatters(m: Matter, all: Matter[]): Matter[] {
  const mine = new Set(matterCasenos(m).map((x) => x.toUpperCase()));
  const out: Matter[] = [];
  for (const x of all) {
    if (x.id === m.id) continue;
    if (m.parentId && x.id === m.parentId) {
      out.push(x);
      continue;
    }
    if (x.parentId && x.parentId === m.id) {
      out.push(x);
      continue;
    }
    const nums = parseConnected(m.connected);
    if (nums.some((n) => isTrackedCaseno(n, matterCasenos(x)))) {
      out.push(x);
      continue;
    }
    if (parseConnected(x.connected).some((n) => isTrackedCaseno(n, [...mine]))) out.push(x);
  }
  return out;
}

export function markCommonOrders(ids: string[]) {
  const matters = useBinder.getState().matters.filter((m) => ids.includes(m.id));
  if (matters.length < 2) return;
  const counts = new Map<string, number>();
  for (const m of matters) {
    const seen = new Set<string>();
    for (const o of m.orders) {
      const k = stamp(o);
      if (!k.endsWith("|") && !seen.has(k)) {
        seen.add(k);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  }
  for (const m of matters) {
    useBinder.getState().patchMatter(
      m.id,
      (x) => {
        x.orders = x.orders.map((o) => ({ ...o, common: (counts.get(stamp(o)) || 0) > 1 }));
      },
      { undo: false },
    );
  }
}

export async function addConnectedCaseno(caseno: string, parent: Matter) {
  const add = addPayloadFromCaseno(caseno);
  if (!add) return { ok: false as const, error: `Could not read ${caseno}.` };
  const existing = useBinder.getState().matters.find((m) => isTrackedCaseno(caseno, matterCasenos(m)));
  if (existing) {
    useBinder.getState().patchMatter(
      existing.id,
      (m) => {
        if (!m.parentId) m.parentId = parent.id;
      },
      { undo: false },
    );
    return { ok: true as const, matter: existing, added: 0 };
  }
  const out = await resolveListing({ data: add });
  if (!out.ok) return { ok: false as const, error: out.error };
  const matter = matterFromLookup({ ...out.params, type_name: out.type_name }, out.lookup);
  matter.parentId = parent.id;
  useBinder.getState().upsertMatter(matter);
  useCourt.getState().log("add", `${matter.petitioner} v ${matter.respondent}`, `Connected to ${parent.petitioner} v ${parent.respondent}`);
  const pulled = await pullMissingOrders(matter);
  return { ok: true as const, matter, added: pulled.added };
}
