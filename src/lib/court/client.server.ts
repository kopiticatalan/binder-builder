import type { CaseType, CourtLookup, LookupParams, StampReg } from "@/lib/types";
import { buildFirmPatterns, isTrackedCaseno, parseCauselistEntries } from "@/lib/court/match";
import {
  CookieJar,
  COURT_SITE,
  courtGet,
  courtPostForm,
  courtRequest,
  mapPool,
} from "@/lib/court/http.server";
import {
  extractInputValue,
  extractMeta,
  extractOrdersWithHref,
  extractParties,
  parseCauselistJudges,
  type OrderWithHref,
} from "@/lib/court/parse.server";
import { excerptText, pdfText } from "@/lib/court/pdf-text.server";

export type { LookupParams };


const typeCache = new Map<string, CaseType[]>();

export async function getCaseTypes(side: string): Promise<CaseType[]> {
  const key = String(side);
  const hit = typeCache.get(key);
  if (hit) return hit;
  const jar = new CookieJar();
  const res = await courtGet(
    `/bhc/get-case-types-by-side?side=${encodeURIComponent(key)}`,
    jar,
  );
  const data = JSON.parse(res.buf.toString("utf8")) as Array<{
    case_type?: number | string;
    type_name?: string;
    full_form?: string;
  }>;
  const out: CaseType[] = [];
  for (const t of Array.isArray(data) ? data : []) {
    if (!t || t.case_type == null) continue;
    const name = t.type_name || "";
    const full = t.full_form || name;
    out.push({
      value: String(t.case_type),
      label: name ? `${name} - ${full}` : full,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  typeCache.set(key, out);
  return out;
}

async function openCasePage(params: LookupParams) {
  const jar = new CookieJar();
  const pageUrl = `${COURT_SITE}/bhc/casestatus/casenumber`;
  const pageRes = await courtGet(pageUrl, jar);
  const page = pageRes.buf.toString("utf8");
  const token = extractInputValue(page, "_token");
  const secret = extractInputValue(page, "form_secret");
  if (!token) {
    throw new Error("Could not obtain a session token from the court site.");
  }
  const search = await courtPostForm(
    pageUrl,
    {
      _token: token,
      form_secret: secret,
      side: params.side,
      stampreg: params.stampreg,
      case_type: params.case_type,
      case_no: params.case_no,
      year: params.year,
    },
    jar,
    { Referer: pageUrl },
  );
  let json: { status?: boolean; page?: string; message?: string };
  try {
    json = JSON.parse(search.buf.toString("utf8"));
  } catch {
    throw new Error("The court site returned an unexpected response.");
  }
  if (!json.status || !json.page) {
    throw new Error(json.message || "No case found for those details.");
  }
  return { jar, html: json.page as string };
}

export async function lookupCase(params: LookupParams): Promise<CourtLookup> {
  const { html } = await openCasePage(params);
  const [petitioner, respondent] = extractParties(html);
  const meta = extractMeta(html);
  const orders = extractOrdersWithHref(html).map(({ href: _h, ...rest }) => rest);
  return { petitioner, respondent, ...meta, orders };
}

export type DownloadedOrder = {
  key: string;
  filename: string;
  base64: string;
  excerpt: string;
  date: string;
  doc: string;
  coram: string;
};

function isPdf(buf: Buffer) {
  return buf.subarray(0, 5).toString("utf8") === "%PDF-";
}

async function downloadPdf(href: string, jar: CookieJar) {
  const res = await courtRequest(href, {
    jar,
    timeoutMs: 90000,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${COURT_SITE}/bhc/casestatus/casenumber`,
      Accept: "application/pdf,*/*",
    },
  });
  if (!isPdf(res.buf)) return null;
  return res.buf;
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

export async function downloadOrders(
  params: LookupParams,
  keys: string[],
  parties: { petitioner?: string; respondent?: string } = {},
): Promise<DownloadedOrder[]> {
  const want = new Set(keys);
  const { jar, html } = await openCasePage(params);
  const orders = extractOrdersWithHref(html).filter((o) => want.has(o.key));
  const pet = sanitize(parties.petitioner || "Petitioner", 40);
  const resp = sanitize(parties.respondent || "Respondent", 40);

  const results = await mapPool(orders, 4, async (o: OrderWithHref) => {
    try {
      const buf = await downloadPdf(o.href, jar);
      if (!buf) return null;
      const ddmmyyyy = (o.date || "").replace(/\//g, "");
      const filename = sanitize(`${ddmmyyyy} ${pet} v ${resp}`) + ".pdf";
      const excerpt = excerptText(pdfText(buf));
      return {
        key: o.key,
        filename,
        base64: buf.toString("base64"),
        excerpt,
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

export type CauselistJudge = {
  judge: string;
  links: { href: string; label: string }[];
};

async function listCauselistDayWithJar(dateDdMm: string, jar: CookieJar): Promise<CauselistJudge[]> {
  const pageUrl = `${COURT_SITE}/bhc/causelistFinal`;
  const pageRes = await courtGet(pageUrl, jar);
  const page = pageRes.buf.toString("utf8");
  const body = {
    _token: extractInputValue(page, "_token"),
    form_secret: extractInputValue(page, "form_secret"),
    chkpassphrase: extractInputValue(page, "chkpassphrase"),
    m_juris: extractInputValue(page, "m_juris") || "B",
    m_causedt: dateDdMm,
  };
  const res = await courtPostForm(`${COURT_SITE}/bhc/causelist/get-data`, body, jar, {
    Referer: pageUrl,
  });
  let json: { status?: boolean; page?: string };
  try {
    json = JSON.parse(res.buf.toString("utf8"));
  } catch {
    return [];
  }
  if (!json.status || !json.page) return [];
  return parseCauselistJudges(json.page);
}

export async function listCauselistDay(dateDdMm: string): Promise<CauselistJudge[]> {
  return listCauselistDayWithJar(dateDdMm, new CookieJar());
}

export type ScanHit = {
  serial: string;
  caseno: string;
  caption: string;
  parties: string;
  connected: string;
  advocates: string[];
  judge: string;
  list_type: string;
  court: string;
};

export async function scanCauselistPdfs(
  input: {
    items: { href: string; judge: string; list_type: string }[];
    watched: string[];
    tracked: string[];
  },
  jar?: CookieJar,
): Promise<ScanHit[]> {
  const pats = buildFirmPatterns(input.watched);
  const session = jar ?? new CookieJar();
  if (!jar) await courtGet(`${COURT_SITE}/bhc/causelistFinal`, session);

  const hits: ScanHit[] = [];
  const results = await mapPool(input.items, 4, async (item) => {
    try {
      const res = await courtRequest(item.href, {
        jar: session,
        timeoutMs: 60000,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${COURT_SITE}/bhc/causelistFinal`,
        },
      });
      if (!isPdf(res.buf)) return [] as ScanHit[];
      const text = pdfText(res.buf);
      const court = (text.match(/COURT\s*NO[.\s]*?(\d+)/i) || [])[1] || "";
      const entries = parseCauselistEntries(text, pats);
      const foldedAdvs: Record<string, string[]> = {};
      for (const e of entries) {
        if (!e.folded) continue;
        const bucket = (foldedAdvs[e.serial] ||= []);
        for (const ad of e.advocates) if (!bucket.includes(ad)) bucket.push(ad);
      }
      const out: ScanHit[] = [];
      for (const e of entries) {
        if (e.folded) continue;
        const advs = [...e.advocates];
        for (const ad of foldedAdvs[e.serial] || []) {
          if (!advs.includes(ad)) advs.push(ad);
        }
        const mine = isTrackedCaseno(e.caseno, input.tracked);
        if (!mine && !advs.length) continue;
        out.push({
          serial: e.serial,
          caseno: e.caseno,
          caption: e.caption,
          parties: e.parties,
          connected: e.connected,
          advocates: advs,
          judge: item.judge,
          list_type: item.list_type,
          court,
        });
      }
      return out;
    } catch {
      return [] as ScanHit[];
    }
  });
  for (const group of results) hits.push(...group);
  return hits;
}

export async function scanBhcDay(input: {
  date: string;
  watched: string[];
  tracked: string[];
}): Promise<{ judges: number; hits: ScanHit[] }> {
  const jar = new CookieJar();
  const judges = await listCauselistDayWithJar(input.date, jar);
  const items = judges.flatMap((j) =>
    j.links.map((l) => ({ href: l.href, judge: j.judge, list_type: l.label })),
  );
  if (!items.length) return { judges: 0, hits: [] };
  const hits = await scanCauselistPdfs(
    { items, watched: input.watched, tracked: input.tracked },
    jar,
  );
  return { judges: judges.length, hits };
}

export async function fetchCauselistPdf(input: {
  date: string;
  judge: string;
  list_type: string;
}): Promise<{ filename: string; base64: string } | null> {
  const jar = new CookieJar();
  const judges = await listCauselistDayWithJar(input.date, jar);
  const jl = input.judge.trim().toLowerCase();
  const tl = input.list_type.trim().toLowerCase();
  for (const jd of judges) {
    if (jd.judge.trim().toLowerCase() !== jl) continue;
    const link =
      jd.links.find((l) => l.label.trim().toLowerCase() === tl) ?? jd.links[0];
    if (!link) continue;
    const res = await courtRequest(link.href, {
      jar,
      timeoutMs: 90000,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${COURT_SITE}/bhc/causelistFinal`,
      },
    });
    if (!isPdf(res.buf)) return null;
    const filename = sanitize(
      `Causelist ${input.list_type} ${input.judge} ${input.date}`,
      110,
    ) + ".pdf";
    return { filename, base64: res.buf.toString("base64") };
  }
  return null;
}

export async function resolveListingAdd(add: {
  abbr: string;
  stampreg: StampReg;
  no: string;
  year: string;
}): Promise<{ params: LookupParams; type_name: string; lookup: CourtLookup }> {
  const abbr = (add.abbr || "").toUpperCase();
  let lastErr = "Could not resolve that case type.";
  for (const side of ["2", "1"] as const) {
    const types = await getCaseTypes(side);
    const matches = types
      .filter((t) => t.label.split(" - ")[0].trim().toUpperCase() === abbr)
      .sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label));
    for (const match of matches) {
      const params: LookupParams = {
        side,
        stampreg: add.stampreg,
        case_type: match.value,
        case_no: String(add.no),
        year: String(add.year),
      };
      try {
        const lookup = await lookupCase(params);
        return { params, type_name: match.label, lookup };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }
  throw new Error(lastErr);
}
