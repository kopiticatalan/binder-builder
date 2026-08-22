import { Buffer } from "node:buffer";
import { CookieJar, courtGet, courtRequest, mapPool } from "@/lib/court/http.server";
import { excerptText, pdfText } from "@/lib/court/pdf-text.server";
import type { CourtLookup } from "@/lib/types";

export const NCLT_SITE = "https://nclt.gov.in";
export const NCLT_EFILE = "https://efiling.nclt.gov.in";

export const NCLT_BENCHES = [
  { value: "9", label: "Mumbai" },
  { value: "10", label: "New Delhi / Principal" },
  { value: "5", label: "Chennai" },
  { value: "8", label: "Kolkata" },
  { value: "1", label: "Ahmedabad" },
  { value: "3", label: "Bengaluru" },
  { value: "7", label: "Hyderabad" },
  { value: "4", label: "Chandigarh" },
  { value: "2", label: "Allahabad" },
  { value: "6", label: "Guwahati" },
  { value: "11", label: "Jaipur" },
  { value: "12", label: "Amaravati" },
  { value: "13", label: "Cuttack" },
  { value: "14", label: "Kochi" },
  { value: "15", label: "Indore" },
] as const;

export const NCLT_CASE_TYPES = [
  { value: "16", label: "Company Petition IB (IBC)" },
  { value: "2", label: "Company Petition (Companies Act)" },
  { value: "15", label: "CP(AA) Merger & Amalgamation" },
  { value: "14", label: "CA(A) Merger & Amalgamation" },
  { value: "13", label: "Company Application (Companies Act)" },
  { value: "18", label: "Company Application (IBC)" },
  { value: "20", label: "Interlocutory Application (IBC)" },
  { value: "4", label: "Interlocutory Application (Companies Act)" },
  { value: "38", label: "IA (IBC) Plan" },
  { value: "39", label: "IA (IBC) Liquidation" },
  { value: "1", label: "Transfer Petition (Companies Act)" },
  { value: "10", label: "Miscellaneous Application (Companies Act)" },
  { value: "26", label: "Miscellaneous Application (IBC)" },
  { value: "33", label: "Insolvency (Pre-Packaged)" },
  { value: "35", label: "Voluntary Liquidation (IBC)" },
] as const;

export type NcltLookupParams = {
  bench: string;
  case_type: string;
  case_no: string;
  year: string;
};

export type NcltListHit = {
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
  bench: string;
};

function typeLabel(value: string) {
  return NCLT_CASE_TYPES.find((t) => t.value === value)?.label || "NCLT case";
}

function benchLabel(value: string) {
  return NCLT_BENCHES.find((b) => b.value === value)?.label || "NCLT";
}

function ncltToDmy(raw: string) {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  return s;
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

async function ncltJson(path: string, jar: CookieJar, opts: { method?: string; body?: string } = {}) {
  const res = await courtRequest(`${NCLT_EFILE}${path}`, {
    method: opts.method || "GET",
    jar,
    body: opts.body,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${NCLT_EFILE}/casehistorybeforeloginmenutrue.drt`,
      Origin: NCLT_EFILE,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    timeoutMs: 60000,
  });
  try {
    return JSON.parse(res.buf.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("NCLT returned an unexpected response.");
  }
}

type PanelRow = {
  filing_no?: string;
  case_no?: string;
  case_title1?: string;
  case_title2?: string;
  case_type_desc_cis?: string;
  bench_location_name?: string;
  date_of_filing?: string;
  regis_date?: string;
  next_list_date?: string;
  listing_date?: string;
  disposal_date?: string;
  status?: string;
  action_type?: string;
  court_no?: string;
  purpose?: string;
  today_action?: string;
  party_name?: string;
  party_type?: string;
  party_lawer_name?: string;
  path_descr?: string;
  encPath?: string;
  order_upload_date?: string;
};

export async function lookupNcltCase(params: NcltLookupParams): Promise<CourtLookup> {
  const case_no = String(params.case_no || "").replace(/\D/g, "");
  const year = String(params.year || "").trim();
  const bench = params.bench || "9";
  if (!case_no || !/^\d{4}$/.test(year)) {
    throw new Error("Enter a case number and a four-digit year.");
  }
  const jar = new CookieJar();
  await courtGet(`${NCLT_EFILE}/casehistorybeforeloginmenutrue.drt`, jar);
  const bean = {
    wayofselection: "casenumber",
    i_bench_id: "0",
    filing_no: "",
    i_bench_id_case_no: bench,
    i_case_type_caseno: params.case_type || "16",
    i_case_year_caseno: year,
    case_no,
    i_party_search: "",
    i_bench_id_party: "0",
    party_type_party: "0",
    party_name_party: "",
    i_case_year_party: "0",
    status_party: "0",
    i_adv_search: "",
    i_bench_id_lawyer: "0",
    party_lawer_name: "",
    i_case_year_lawyer: "0",
    bar_council_advocate: "",
  };
  const found = await ncltJson("/caseHistoryoptional.drt", jar, {
    method: "POST",
    body: JSON.stringify(bean),
  });
  const list = (found.mainpanellist as PanelRow[] | undefined) || [];
  const row = list[0];
  if (!row?.filing_no) {
    throw new Error("No NCLT matter found for those details. Check bench, type, number and year.");
  }
  const det = await ncltJson(
    `/caseHistoryalldetails.drt?filing_no=${encodeURIComponent(row.filing_no)}&flagIA=false`,
    jar,
  );
  const parties = ((det.partydetailslist as PanelRow[]) || []) as PanelRow[];
  const petitioners = parties.filter((p) => /^P/i.test(p.party_type || "")).map((p) => p.party_name || "");
  const respondents = parties.filter((p) => /^R/i.test(p.party_type || "")).map((p) => p.party_name || "");
  const petAdv = parties.find((p) => p.party_lawer_name && p.party_lawer_name !== "NA")?.party_lawer_name || "";
  const procs = ((det.allproceedingdtls as PanelRow[]) || []).filter((p) => p.encPath);
  const orders: CourtLookup["orders"] = procs.slice(0, 40).map((p, i) => {
    const date = ncltToDmy(p.listing_date || p.order_upload_date || "");
    return {
      key: `${date}|${p.path_descr || "Order"}|${i}`,
      srl: String(i + 1),
      date,
      doc: p.path_descr || p.purpose || "Order",
      coram: [p.bench_location_name, p.court_no ? `Court ${p.court_no}` : ""].filter(Boolean).join(" · "),
    };
  });
  const latest = procs[0];
  const statusRaw = row.status || row.action_type || "";
  return {
    petitioner: row.case_title1 || petitioners[0] || "",
    respondent: row.case_title2 || respondents[0] || "",
    cnr: row.filing_no,
    filed_on: ncltToDmy(row.date_of_filing || ""),
    registration_date: ncltToDmy(row.regis_date || ""),
    status: /dispos/i.test(statusRaw) ? statusRaw : statusRaw || "Pending",
    disposal_date: ncltToDmy(row.disposal_date === "NA" ? "" : row.disposal_date || ""),
    lodging: row.case_no || "",
    next_listing: ncltToDmy(row.next_list_date === "NA" ? "" : row.next_list_date || ""),
    petitioner_adv: petAdv,
    respondent_adv: "",
    stage: latest?.purpose || latest?.today_action || "",
    act: `${typeLabel(params.case_type)} · ${benchLabel(bench)}`,
    last_coram: latest ? `Court ${latest.court_no || ""}`.trim() : "",
    orders,
  };
}

type DownloadedOrder = {
  key: string;
  filename: string;
  base64: string;
  excerpt: string;
  date: string;
  doc: string;
  coram: string;
};

export async function downloadNcltOrders(
  params: NcltLookupParams,
  keys: string[],
  parties: { petitioner?: string; respondent?: string } = {},
): Promise<DownloadedOrder[]> {
  const want = new Set(keys);
  const case_no = String(params.case_no || "").replace(/\D/g, "");
  const jar = new CookieJar();
  await courtGet(`${NCLT_EFILE}/casehistorybeforeloginmenutrue.drt`, jar);
  const found = await ncltJson("/caseHistoryoptional.drt", jar, {
    method: "POST",
    body: JSON.stringify({
      wayofselection: "casenumber",
      i_bench_id: "0",
      filing_no: "",
      i_bench_id_case_no: params.bench || "9",
      i_case_type_caseno: params.case_type || "16",
      i_case_year_caseno: params.year,
      case_no,
      i_party_search: "",
      i_bench_id_party: "0",
      party_type_party: "0",
      party_name_party: "",
      i_case_year_party: "0",
      status_party: "0",
      i_adv_search: "",
      i_bench_id_lawyer: "0",
      party_lawer_name: "",
      i_case_year_lawyer: "0",
      bar_council_advocate: "",
    }),
  });
  const row = ((found.mainpanellist as PanelRow[]) || [])[0];
  if (!row?.filing_no) return [];
  const det = await ncltJson(
    `/caseHistoryalldetails.drt?filing_no=${encodeURIComponent(row.filing_no)}&flagIA=false`,
    jar,
  );
  const procs = ((det.allproceedingdtls as PanelRow[]) || []).filter((p) => p.encPath);
  const mapped = procs.slice(0, 40).map((p, i) => {
    const date = ncltToDmy(p.listing_date || p.order_upload_date || "");
    return {
      key: `${date}|${p.path_descr || "Order"}|${i}`,
      date,
      doc: p.path_descr || "Order",
      coram: [p.bench_location_name, p.court_no ? `Court ${p.court_no}` : ""].filter(Boolean).join(" · "),
      encPath: p.encPath as string,
    };
  }).filter((o) => want.has(o.key));
  const pet = sanitize(parties.petitioner || "Petitioner", 40);
  const resp = sanitize(parties.respondent || "Respondent", 40);
  const results = await mapPool(mapped, 3, async (o) => {
    try {
      const res = await courtRequest(
        `${NCLT_EFILE}/ordersview.drt?path=${encodeURIComponent(o.encPath)}`,
        {
          jar,
          timeoutMs: 90000,
          headers: {
            Referer: `${NCLT_EFILE}/casehistorybeforeloginmenutrue.drt`,
            Accept: "application/pdf,*/*",
          },
        },
      );
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

function courtToBench(court: string) {
  const s = court.toLowerCase();
  if (s.includes("mumbai")) return "9";
  if (s.includes("delhi") || s.includes("principal")) return "10";
  if (s.includes("chennai")) return "5";
  if (s.includes("kolkata")) return "8";
  if (s.includes("ahmedabad")) return "1";
  if (s.includes("bengaluru") || s.includes("bangalore")) return "3";
  if (s.includes("hyderabad")) return "7";
  if (s.includes("chandigarh")) return "4";
  if (s.includes("allahabad")) return "2";
  if (s.includes("guwahati")) return "6";
  if (s.includes("jaipur")) return "11";
  if (s.includes("amaravati")) return "12";
  if (s.includes("cuttack")) return "13";
  if (s.includes("kochi")) return "14";
  if (s.includes("indore")) return "15";
  return "";
}

function toMmDdYyyy(date: string) {
  const dmy = date.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return `${dmy[2]}/${dmy[1]}/${dmy[3]}`;
  return date;
}

type IndexRow = { title: string; court: string; date: string; href: string; entries: string };

function parseIndex(html: string): IndexRow[] {
  const out: IndexRow[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const href = row[1].match(/href="(\/sites\/default\/files\/pdf_cause_list\/[^"]+\.pdf)"/i)?.[1];
    if (!href) continue;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    out.push({
      title: cells[1] || "",
      court: cells[2] || "",
      entries: cells[3] || "",
      date: cells[4] || "",
      href: href.startsWith("http") ? href : NCLT_SITE + href,
    });
  }
  return out;
}

const CASE_RE =
  /((?:C\.?\s*P\.?|C\.?\s*A\.?|I\.?\s*A\.?|CP|CA|IA|COMP\.?\s*APPL)[^\n]{0,18}?\d{1,5}\s*(?:\/|\()\s*(?:MB|IB|CAA|NCLT|[A-Z]{2,4})\)?\s*\/?\s*\d{4})/gi;

function normalizeCaseno(raw: string) {
  return raw.replace(/en-US/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

export function ncltCasenoKeys(raw: string) {
  const t = normalizeCaseno(raw);
  const digits = t.match(/(\d{1,5}).{0,12}(\d{4})/);
  const out = [t];
  if (digits) {
    out.push(`${digits[1]}/${digits[2]}`);
    out.push(digits[1]);
  }
  return out;
}

function parseNcltPdf(text: string, meta: IndexRow): NcltListHit[] {
  const clean = text.replace(/en-US/g, " ").replace(/\s+/g, " ");
  const hits: NcltListHit[] = [];
  const matches = [...clean.matchAll(CASE_RE)];
  const seen = new Set<string>();
  let serial = 0;
  for (const m of matches) {
    const caseno = normalizeCaseno(m[1]);
    if (seen.has(caseno)) continue;
    seen.add(caseno);
    serial += 1;
    const around = clean.slice(Math.max(0, m.index! - 40), m.index! + 280);
    const vs = around.split(/\bV\/?s\b/i);
    const parties = vs.length > 1
      ? `${vs[0].slice(-80).replace(/^.*\d{4}\s*/, "").trim()} v ${vs[1].slice(0, 80).trim()}`
      : "";
    const yearM = caseno.match(/(\d{4})\s*$/);
    const noM = caseno.match(/(\d{1,5})/);
    hits.push({
      caseno,
      serial: String(serial),
      parties: parties.slice(0, 160),
      caption: caseno,
      court: meta.court,
      judge: meta.court,
      list_type: meta.title || "Cause list",
      advocates: [],
      connected: "",
      href: meta.href,
      type_name: caseno.includes("IB") ? "Company Petition IB (IBC)" : "NCLT",
      no: noM?.[1] || "",
      year: yearM?.[1] || "",
      bench: courtToBench(meta.court),
    });
  }
  return hits;
}

export async function scanNcltCauselists(opts: {
  dates: string[];
  watched: string[];
  tracked: string[];
  benches: string[];
}): Promise<NcltListHit[]> {
  const wantedBenches = new Set(opts.benches.length ? opts.benches : ["9"]);
  const tracked = opts.tracked.map((t) => t.toUpperCase());
  const watch = opts.watched.map((w) => w.trim().toLowerCase()).filter(Boolean);
  const sorted = [...opts.dates].sort();
  const start = toMmDdYyyy(sorted[0] || "");
  const end = toMmDdYyyy(sorted[sorted.length - 1] || sorted[0] || "");
  const index: IndexRow[] = [];
  for (let page = 0; page < 6; page += 1) {
    const url =
      `${NCLT_SITE}/all-cause-list?field_nclt_benches_list_target_id=All` +
      `&field_cause_date_value=${encodeURIComponent(start)}` +
      `&field_cause_date_value_1=${encodeURIComponent(end)}` +
      `&page=${page}`;
    const res = await courtGet(url);
    const rows = parseIndex(res.buf.toString("utf8"));
    if (!rows.length) break;
    index.push(...rows);
    if (rows.length < 20) break;
  }
  const pdfs = index.filter((r) => {
    const b = courtToBench(r.court);
    return !b || wantedBenches.has(b) || wantedBenches.has("all");
  });
  const all: NcltListHit[] = [];
  const parsed = await mapPool(pdfs.slice(0, 40), 4, async (row) => {
    try {
      const res = await courtGet(row.href);
      if (!isPdf(res.buf)) return [] as NcltListHit[];
      return parseNcltPdf(pdfText(res.buf), row);
    } catch {
      return [] as NcltListHit[];
    }
  });
  for (const hits of parsed) {
    for (const hit of hits) {
      const keys = ncltCasenoKeys(hit.caseno);
      const mine = tracked.some((t) => keys.some((k) => t.includes(k) || k.includes(t)));
      const blob = `${hit.parties} ${hit.caseno}`.toLowerCase();
      const advHits = watch.filter((w) => blob.includes(w));
      if (mine || advHits.length) {
        all.push({
          ...hit,
          advocates: advHits.map((w) => opts.watched.find((x) => x.toLowerCase() === w) || w),
        });
      }
    }
  }
  return all;
}

export function ncltTypeFromAbbr(abbr: string) {
  const a = abbr.toUpperCase().replace(/\s+/g, "");
  if (a.includes("IB") && (a.includes("CP") || a.includes("C.P") || a.includes("PETITION"))) return "16";
  if (a.includes("CAA") && a.includes("CP")) return "15";
  if (a.includes("CAA")) return "14";
  if (a.includes("IA")) return "20";
  return "16";
}
