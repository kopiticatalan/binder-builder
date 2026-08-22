import type { CourtLookup, OrderMeta } from "@/lib/types";

export function extractInputValue(page: string, name: string): string {
  const a = page.match(
    new RegExp(`<input[^>]*\\bname="${escapeRe(name)}"[^>]*\\bvalue="([^"]*)"`, "i"),
  );
  if (a) return a[1];
  const b = page.match(
    new RegExp(`<input[^>]*\\bvalue="([^"]*)"[^>]*\\bname="${escapeRe(name)}"`, "i"),
  );
  return b ? b[1] : "";
}

export function stripTags(s: string) {
  return (s || "").replace(/<[^>]+>/g, " ");
}

export function decodeEntities(s: string) {
  return (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

export function clean(s: string) {
  return decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
}

export function orderKey(o: { date?: string; doc?: string }) {
  return `${o.date || ""}|${o.doc || ""}`.replace(/^\||\|$/g, "");
}

function afterLabel(text: string, label: string) {
  const m = text.match(
    new RegExp(`${escapeRe(label)}\\s*[:\\-–]?\\s*([^\\n]{1,80})`, "i"),
  );
  return m ? clean(m[1]) : "";
}

function dateAfter(text: string, label: string) {
  const m = text.match(
    new RegExp(`${escapeRe(label)}[^0-9]{0,24}(\\d{2}/\\d{2}/\\d{4})`, "i"),
  );
  return m ? m[1] : "";
}

export function extractParties(page: string): [string, string] {
  const text = clean(page);
  const m = text.match(
    /\bby\s+(.+?)\s+against\s+(.+?)(?:\s+District|\s+Filing Number|\s+Lodging Number|\s+Registration Date|\s+Next Listing|\s+Disposal|\.\s|$)/i,
  );
  if (m) return [clean(m[1]), clean(m[2])];
  const pet = afterLabel(text, "Petitioner");
  const res = afterLabel(text, "Respondent");
  return [pet.split(" Petitioner")[0], res.split(" Petitioner")[0] || res];
}

export function extractMeta(page: string): Omit<CourtLookup, "orders" | "petitioner" | "respondent"> {
  const text = clean(page);
  const cnr = (text.match(/\b(HCBM\w+)\b/) || [])[1] || "";
  const filed = (text.match(/filed on\s+(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || "";
  const statusRaw = afterLabel(text, "Status");
  const status = statusRaw
    .replace(/Petitioner.*$/i, "")
    .replace(/_/g, " ")
    .trim()
    .slice(0, 48);
  const lodging = (
    text.match(/Lodging Number\s+([A-Z]+\(?L?\)?\/\d+\/\d{4})/i) || []
  )[1] || "";
  const petAdv = afterLabel(text, "Petitioner's Advocate")
    .replace(/Respondent's Advocate.*$/i, "")
    .slice(0, 120);
  const resAdv = afterLabel(text, "Respondent's Advocate")
    .replace(/Last Date.*$/i, "")
    .slice(0, 120);
  const stage = afterLabel(text, "Stage").replace(/Last Coram.*$/i, "").slice(0, 80);
  const act = afterLabel(text, "Act").replace(/Under Section.*$/i, "").slice(0, 80);
  const lastCoram = afterLabel(text, "Last Coram").replace(/Act .*$/i, "").slice(0, 160);
  return {
    cnr,
    filed_on: filed,
    registration_date: dateAfter(text, "Registration Date"),
    status,
    disposal_date: dateAfter(text, "Disposal Date"),
    lodging,
    next_listing: dateAfter(text, "Next Listing Date"),
    petitioner_adv: petAdv === "—" ? "" : petAdv,
    respondent_adv: resAdv === "—" ? "" : resAdv,
    stage: stage === "—" ? "" : stage,
    act,
    last_coram: lastCoram === "—" ? "" : lastCoram,
  };
}

const ORDER_HREF =
  /href="([^"]*(?:file\/download|order-pdf|casestatus\/order)[^"]*)"/i;

export function extractOrders(
  page: string,
): Omit<OrderMeta, "downloaded" | "excerpt">[] {
  const idxDoc = page.search(/View Document|order-pdf|file\/download/i);
  if (idxDoc < 0) return [];
  const start = page.lastIndexOf("<table", idxDoc);
  const end = page.indexOf("</table>", idxDoc);
  const table = start >= 0 && end >= 0 ? page.slice(start, end) : page;
  const orders: Omit<OrderMeta, "downloaded" | "excerpt">[] = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const html = row[1];
    const hrefM = html.match(ORDER_HREF);
    if (!hrefM) continue;
    const cells = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      clean(c[1]),
    );
    let date = "";
    for (const t of cells) {
      const m = t.match(/\d{2}\/\d{2}\/\d{4}/);
      if (m) {
        date = m[0];
        break;
      }
    }
    const o = {
      srl: cells[0] || "",
      date,
      doc: cells[3] || "",
      coram: cells[1] || "",
      href: decodeEntities(hrefM[1]),
    };
    orders.push({
      key: orderKey(o),
      srl: o.srl,
      date: o.date,
      doc: o.doc,
      coram: o.coram,
    });
    (orders[orders.length - 1] as { href?: string }).href = o.href;
  }
  return orders;
}

export type OrderWithHref = Omit<OrderMeta, "downloaded" | "excerpt"> & {
  href: string;
};

export function extractOrdersWithHref(page: string): OrderWithHref[] {
  const idxDoc = page.search(/View Document|order-pdf|file\/download/i);
  if (idxDoc < 0) return [];
  const start = page.lastIndexOf("<table", idxDoc);
  const end = page.indexOf("</table>", idxDoc);
  const table = start >= 0 && end >= 0 ? page.slice(start, end) : page;
  const orders: OrderWithHref[] = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const html = row[1];
    const hrefM = html.match(ORDER_HREF);
    if (!hrefM) continue;
    const cells = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      clean(c[1]),
    );
    let date = "";
    for (const t of cells) {
      const m = t.match(/\d{2}\/\d{2}\/\d{4}/);
      if (m) {
        date = m[0];
        break;
      }
    }
    const o = {
      srl: cells[0] || "",
      date,
      doc: cells[3] || "",
      coram: cells[1] || "",
      href: decodeEntities(hrefM[1]),
    };
    orders.push({
      key: orderKey(o),
      srl: o.srl,
      date: o.date,
      doc: o.doc,
      coram: o.coram,
      href: o.href,
    });
  }
  return orders;
}

export function parseCauselistJudges(page: string) {
  const judges: { judge: string; links: { href: string; label: string }[] }[] =
    [];
  for (const row of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const html = row[1];
    if (!/file\/download/i.test(html)) continue;
    const cells = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) => clean(c[1]),
    );
    const judge = cells[0] || "";
    const links: { href: string; label: string }[] = [];
    for (const a of html.matchAll(
      /href="([^"]*file\/download[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      links.push({
        href: decodeEntities(a[1]),
        label: clean(a[2]) || "Causelist",
      });
    }
    if (judge && links.length) judges.push({ judge, links });
  }
  return judges;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
