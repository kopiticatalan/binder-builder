import { Buffer } from "node:buffer";
import { CookieJar, courtGet, courtPostForm, courtRequest, mapPool } from "@/lib/court/http.server";
import { clean } from "@/lib/court/parse.server";
import { excerptText, pdfText } from "@/lib/court/pdf-text.server";
import type { CourtLookup, OrderMeta } from "@/lib/types";

type DownloadedOrder = {
  key: string;
  filename: string;
  base64: string;
  excerpt: string;
  date: string;
  doc: string;
  coram: string;
};

export const SAT_SITE = "https://satweb.sat.gov.in";

export const SAT_APPEAL_TYPES = [
  { value: "1", label: "SEBI" },
  { value: "2", label: "IRDAI" },
  { value: "3", label: "PFRDA" },
] as const;

export type SatLookupParams = {
  case_type: string;
  case_no: string;
  year: string;
};

export type SatListHit = {
  caseno: string;
  serial: string;
  parties: string;
  caption: string;
  court: string;
  judge: string;
  list_type: string;
  advocates: string[];
  connected: string;
  href: string;
  type_name: string;
  no: string;
  year: string;
};

function typeLabel(value: string) {
  return SAT_APPEAL_TYPES.find((t) => t.value === value)?.label || "SEBI";
}

export function padSatNo(no: string) {
  const n = String(no || "").replace(/\D/g, "");
  if (!n) return "";
  return n.length >= 4 ? n : n.padStart(4, "0");
}

export function satToDmy(raw: string) {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const y = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${slash[1].padStart(2, "0")}/${slash[2].padStart(2, "0")}/${y}`;
  }
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const en = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (en) {
    const mon = months[en[2].slice(0, 3).toLowerCase()];
    if (mon) return `${en[1].padStart(2, "0")}/${mon}/${en[3]}`;
  }
  return s;
}

function extractToken(html: string) {
  const m = html.match(/id="security_token"\s+value="([^"]+)"/i);
  return m?.[1] || "";
}

async function satPage(path: string, jar: CookieJar) {
  const res = await courtGet(`${SAT_SITE}${path}`, jar);
  return { html: res.buf.toString("utf8"), token: extractToken(res.buf.toString("utf8")) };
}

type SatJson = { status?: string; content?: string; token?: string };

async function satPost(
  path: string,
  fields: Record<string, string>,
  jar: CookieJar,
  referer: string,
): Promise<SatJson> {
  const res = await courtPostForm(`${SAT_SITE}${path}`, fields, jar, {
    Referer: referer,
    Origin: SAT_SITE,
    Accept: "application/json, text/javascript, */*; q=0.01",
  });
  try {
    return JSON.parse(res.buf.toString("utf8")) as SatJson;
  } catch {
    throw new Error("SAT returned an unexpected response.");
  }
}

function cellTexts(rowHtml: string) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
    clean(c[1].replace(/<br\s*\/?>/gi, " | ")),
  );
}

function parseCaseStatus(html: string) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const filing = row[1].match(/data-id="(\d+)"/i)?.[1];
    const cells = cellTexts(row[1]);
    if (!filing || cells.length < 6) continue;
    const vs = cells[4] || "";
    const parts = vs.split(/\s+vs\.?\s+/i);
    return {
      filing_no: filing,
      appeal_type: cells[1] || "",
      lodging: cells[2] || "",
      appeal_no: cells[3] || "",
      petitioner: (parts[0] || vs).trim(),
      respondent: (parts[1] || "").trim(),
      filed_on: satToDmy(cells[5] || ""),
      status: cells[6] || "",
    };
  }
  return null;
}

function afterHeadingTable(html: string, heading: string) {
  const idx = html.search(new RegExp(`<h3[^>]*>\\s*${heading}`, "i"));
  if (idx < 0) return "";
  const slice = html.slice(idx);
  const start = slice.search(/<table/i);
  const end = slice.search(/<\/table>/i);
  if (start < 0 || end < 0) return "";
  return slice.slice(start, end + 8);
}

function firstRowCells(tableHtml: string) {
  const row = tableHtml.match(/<tbody[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i);
  return row ? cellTexts(row[1]) : [];
}

function parseHistory(html: string) {
  const party = afterHeadingTable(html, "Party");
  const partyCells = firstRowCells(party);
  const counsel = afterHeadingTable(html, "Counsel Details");
  const counselCells = firstRowCells(counsel);
  const next = afterHeadingTable(html, "Next date of Listing");
  const nextCells = firstRowCells(next);
  const hist = afterHeadingTable(html, "Case Listing History");
  const histRow = hist.match(/<tbody[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i);
  const histCells = histRow ? cellTexts(histRow[1]) : [];
  const nextDate = satToDmy(nextCells[0] || "");
  const nextPurpose = nextCells[1] || "";
  return {
    petitioner: partyCells[0] || "",
    respondent: partyCells[1] || "",
    petitioner_adv: counselCells[0] || "",
    respondent_adv: counselCells[1] || "",
    next_listing: /no record/i.test(nextDate) ? "" : nextDate,
    stage: /no record/i.test(nextPurpose) ? "" : nextPurpose,
    last_listing: satToDmy(histCells[0] || ""),
    last_coram: histCells[2] || "",
  };
}

function parseOrders(html: string): (Omit<OrderMeta, "downloaded" | "excerpt"> & { href: string })[] {
  const orders: (Omit<OrderMeta, "downloaded" | "excerpt"> & { href: string })[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const href = row[1].match(/href="(https?:\/\/satweb\.sat\.gov\.in\/view-order\/[^"]+)"/i)?.[1];
    if (!href) continue;
    const cells = cellTexts(row[1]);
    const date = satToDmy(cells[5] || cells.find((c) => /\d{2}[/-]\d{2}[/-]\d{2,4}/.test(c)) || "");
    const id = href.split("/").pop() || "";
    orders.push({
      key: `${date}|${id}`,
      srl: cells[0] || String(orders.length + 1),
      date,
      doc: cells[2] || "Order",
      coram: cells[4] || "",
      href,
    });
  }
  return orders;
}

export async function lookupSatCase(params: SatLookupParams): Promise<CourtLookup> {
  const case_no = padSatNo(params.case_no);
  const year = String(params.year || "").trim();
  if (!case_no || !/^\d{4}$/.test(year)) {
    throw new Error("Enter an appeal number and a four-digit year.");
  }
  const jar = new CookieJar();
  const page = await satPage("/case-status", jar);
  if (!page.token) throw new Error("Could not open the SAT case-status page.");
  const found = await satPost(
    "/get-case-status",
    {
      bench: "1",
      case_type: params.case_type || "1",
      case_no,
      filing_year: year,
      token: page.token,
    },
    jar,
    `${SAT_SITE}/case-status`,
  );
  const statusHtml = found.content || "";
  const row = parseCaseStatus(statusHtml);
  if (!row) {
    throw new Error("No SAT appeal found for those details. Check type, number and year.");
  }
  let history = {
    petitioner: row.petitioner,
    respondent: row.respondent,
    petitioner_adv: "",
    respondent_adv: "",
    next_listing: "",
    stage: "",
    last_listing: "",
    last_coram: "",
  };
  if (row.filing_no && found.token) {
    const hist = await satPost(
      "/get-case-history",
      { filing_no: row.filing_no, token: found.token },
      jar,
      `${SAT_SITE}/case-status`,
    );
    history = { ...history, ...parseHistory(hist.content || "") };
  }
  const ordersPage = await satPage("/orders", jar);
  let orders: CourtLookup["orders"] = [];
  if (ordersPage.token) {
    const listed = await satPost(
      "/get-orders-by-case",
      {
        bench: "1",
        case_type: params.case_type || "1",
        case_no,
        filing_year: year,
        security_token: ordersPage.token,
      },
      jar,
      `${SAT_SITE}/orders`,
    );
    orders = parseOrders(listed.content || "").map(({ href: _h, ...rest }) => rest);
  }
  return {
    petitioner: history.petitioner || row.petitioner,
    respondent: history.respondent || row.respondent,
    cnr: row.filing_no,
    filed_on: row.filed_on,
    registration_date: row.filed_on,
    status: row.status,
    disposal_date: /dispos/i.test(row.status) ? row.filed_on : "",
    lodging: row.lodging,
    next_listing: history.next_listing,
    petitioner_adv: history.petitioner_adv,
    respondent_adv: history.respondent_adv,
    stage: history.stage,
    act: typeLabel(params.case_type),
    last_coram: history.last_coram,
    orders,
  };
}

function isPdf(buf: Buffer) {
  return buf.subarray(0, 5).toString("utf8") === "%PDF-";
}

function sanitize(s: string, maxlen = 80) {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, maxlen)
    .trim();
}

export async function downloadSatOrders(
  params: SatLookupParams,
  keys: string[],
  parties: { petitioner?: string; respondent?: string } = {},
): Promise<DownloadedOrder[]> {
  const want = new Set(keys);
  const case_no = padSatNo(params.case_no);
  const jar = new CookieJar();
  const page = await satPage("/orders", jar);
  if (!page.token) throw new Error("Could not open SAT orders.");
  const listed = await satPost(
    "/get-orders-by-case",
    {
      bench: "1",
      case_type: params.case_type || "1",
      case_no,
      filing_year: String(params.year),
      security_token: page.token,
    },
    jar,
    `${SAT_SITE}/orders`,
  );
  const orders = parseOrders(listed.content || "").filter((o) => want.has(o.key));
  const pet = sanitize(parties.petitioner || "Appellant", 40);
  const resp = sanitize(parties.respondent || "Respondent", 40);
  const results = await mapPool(orders, 3, async (o) => {
    try {
      const res = await courtRequest(o.href, {
        jar,
        timeoutMs: 90000,
        headers: {
          Referer: `${SAT_SITE}/orders`,
          Accept: "application/pdf,*/*",
        },
      });
      if (!isPdf(res.buf)) return null;
      const ddmmyyyy = (o.date || "").replace(/\//g, "");
      return {
        key: o.key,
        filename: sanitize(`${ddmmyyyy} ${pet} v ${resp}`) + ".pdf",
        base64: res.buf.toString("base64"),
        excerpt: excerptText(pdfText(res.buf)),
        date: o.date,
        doc: o.doc,
        coram: o.coram,
      } satisfies DownloadedOrder;
    } catch {
      return null;
    }
  });
  return results.filter((x): x is DownloadedOrder => x !== null);
}

function parseCauselistIndex(html: string) {
  const out: { date: string; court: string; href: string }[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const href = row[1].match(/href="(https?:\/\/satweb\.sat\.gov\.in\/view-causelist\/[^"]+)"/i)?.[1];
    if (!href) continue;
    const cells = cellTexts(row[1]);
    const date = satToDmy(cells[1] || "");
    out.push({ date, court: cells[2] || "1", href });
  }
  return out;
}

function parseDailyCauselist(html: string, href: string): SatListHit[] {
  const hits: SatListHit[] = [];
  let court = "1";
  let judge = "";
  let purpose = "Cause list";
  const courtM = html.match(/COURT\s*NO\s*:?\s*(\d+)/i);
  if (courtM) court = courtM[1];
  const coram = html.match(/CORAM:[\s\S]{0,40}HON'BLE:\s*([^<]+)/i);
  if (coram) judge = clean(coram[1]);
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const text = clean(row[1]);
    const purposeM = text.match(/PURPOSE:\s*(.+)$/i);
    if (purposeM && !/<t[dh]/i.test(purposeM[1])) {
      purpose = purposeM[1].trim();
      continue;
    }
    if (/COURT\s*NO/i.test(text)) {
      const m = text.match(/COURT\s*NO\s*:?\s*(\d+)/i);
      if (m) court = m[1];
      continue;
    }
    if (/CORAM:/i.test(text)) {
      const names = [...row[1].matchAll(/HON'BLE:\s*([^<]+)/gi)].map((x) => clean(x[1]));
      if (names.length) judge = names.join(" · ");
      continue;
    }
    const cells = cellTexts(row[1]);
    if (cells.length < 5) continue;
    const appealCell = cells[1] || "";
    const appeal = appealCell.match(/Appeal\s*[-–]?\s*(\d{1,5})\s*\/\s*(\d{4})/i);
    if (!appeal) continue;
    const typeM = appealCell.match(/Main Matter:\s*(SEBI|IRDAI?|PFRDA)/i);
    const type_name = (typeM?.[1] || "SEBI").replace(/IRDA$/i, "IRDAI");
    const no = padSatNo(appeal[1]);
    const year = appeal[2];
    const caseno = `${type_name}/${no}/${year}`;
    const appellant = cells[2] || "";
    const respondent = cells[4] || "";
    const advCell = `${cells[3] || ""} ${cells[5] || ""}`;
    const advocates = advCell
      .split("|")
      .map((s) => s.replace(/\[[^\]]+\]/g, "").trim())
      .filter((s) => s.length > 2);
    hits.push({
      caseno,
      serial: cells[0] || String(hits.length + 1),
      parties: [appellant, respondent].filter(Boolean).join(" v "),
      caption: caseno,
      court,
      judge,
      list_type: purpose || "Cause list",
      advocates,
      connected: /Sub Matter/i.test(appealCell) ? appealCell : "",
      href,
      type_name,
      no,
      year,
    });
  }
  return hits;
}

function dmyToIso(dmy: string) {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toDdMmYyyy(date: string) {
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = date.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return date;
}

function dateKey(raw: string) {
  const dmy = satToDmy(raw);
  return dmyToIso(dmy).replace(/-/g, "");
}

export async function scanSatCauselists(opts: {
  dates: string[];
  watched: string[];
  tracked: string[];
}): Promise<SatListHit[]> {
  const wanted = new Set(opts.dates.map(dateKey).filter(Boolean));
  const tracked = new Set(opts.tracked.map((t) => t.toUpperCase()));
  const watch = opts.watched.map((w) => w.trim().toLowerCase()).filter(Boolean);
  const jar = new CookieJar();
  const page = await satPage("/causelist", jar);
  if (!page.token) throw new Error("Could not open the SAT cause list.");
  const sorted = [...opts.dates].sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  const listed = await satPost(
    "/get-causelist",
    {
      startDate: toDdMmYyyy(sorted[0]),
      endDate: toDdMmYyyy(sorted[sorted.length - 1] || sorted[0]),
      token: page.token,
    },
    jar,
    `${SAT_SITE}/causelist`,
  );
  const index = parseCauselistIndex(listed.content || "");
  const days = index.filter((row) => wanted.has(dateKey(row.date)));
  const all: SatListHit[] = [];
  for (const day of days) {
    try {
      const res = await courtGet(day.href, jar);
      const html = res.buf.toString("utf8");
      const parsed = parseDailyCauselist(html, day.href);
      for (const hit of parsed) {
        const needle = `${hit.no}/${hit.year}`.toUpperCase();
        const mine =
          tracked.has(hit.caseno.toUpperCase()) ||
          [...tracked].some((t) => t.includes(needle));
        const advHits = watch.filter((w) =>
          `${hit.advocates.join(" ")} ${hit.parties}`.toLowerCase().includes(w),
        );
        if (mine || advHits.length) {
          all.push({
            ...hit,
            advocates: mine
              ? hit.advocates
              : advHits.map((w) => opts.watched.find((x) => x.toLowerCase() === w) || w),
          });
        }
      }
    } catch {
      /* skip a bad day */
    }
  }
  return all;
}
