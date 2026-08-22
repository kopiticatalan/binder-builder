export function firmRegex(name: string): RegExp | null {
  const tokens = (name || "").match(/[A-Za-z]+/g) || [];
  const parts: string[] = [];
  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (tl === "and") continue;
    if (tl === "co" || tl === "company") parts.push("(?:co|company)\\b");
    else parts.push(escapeRe(tl));
  }
  if (!parts.length) return null;
  return new RegExp(parts.join("[\\s,.]*(?:&|and)?[\\s,.]*"), "i");
}

export function matchAdvocates(text: string, pats: { name: string; rx: RegExp }[]) {
  return pats.filter((p) => p.rx.test(text)).map((p) => p.name);
}

export function buildFirmPatterns(watched: string[]) {
  const pats: { name: string; rx: RegExp }[] = [];
  for (const name of watched) {
    const rx = firmRegex(name);
    if (rx) pats.push({ name: name.trim(), rx });
  }
  return pats;
}

export function casenoKey(s: string) {
  const t = (s || "").toUpperCase().replace(/\s+/g, "");
  const m = t.match(/^([A-Z]{1,12})(?:\(L\)|L)?\/(\d+)\/(\d{4})$/);
  if (m) {
    return {
      abbr: m[1],
      no: m[2].replace(/^0+/, "") || m[2],
      year: m[3],
    };
  }
  const n = t.match(/(\d+)\/(\d{4})/);
  if (n) {
    return {
      abbr: "",
      no: n[1].replace(/^0+/, "") || n[1],
      year: n[2],
    };
  }
  return null;
}

/** Your matters match on case number even if the firm name is not on that board. */
export function isTrackedCaseno(caseno: string, tracked: string[]) {
  const u = (caseno || "").toUpperCase().trim();
  if (!u || !tracked?.length) return false;
  const list = tracked.map((t) => (t || "").toUpperCase().trim()).filter(Boolean);
  if (list.includes(u)) return true;
  const a = casenoKey(u);
  for (const t of list) {
    if (t === u) return true;
    const b = casenoKey(t);
    if (a && b && a.no === b.no && a.year === b.year) {
      if (!a.abbr || !b.abbr || a.abbr === b.abbr) return true;
    }
  }
  return false;
}

const CASE_TOKEN = "[A-Z]{2,8}(?:\\([A-Z]+\\))?/\\d+/\\d{4}";
const LEAD_RE = new RegExp(`(\\d+)\\s+(${CASE_TOKEN})`, "g");
const CONN_RE = new RegExp(`(?:with|a/?w|along\\s*with)\\s+(${CASE_TOKEN})`, "gi");

export type CauselistEntry = {
  serial: string;
  caseno: string;
  caption: string;
  parties: string;
  advocates: string[];
  connected: string;
  folded: boolean;
};

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function short(s: string, n = 55) {
  const t = clean(s);
  return t.length > n ? t.slice(0, n).trim() : t;
}

function isInterloc(cn: string) {
  const ab = (cn.match(/^[A-Z]+/) || [""])[0];
  return ab === "IA" || ab.startsWith("NM");
}

export function parseCauselistEntries(
  text: string,
  pats: { name: string; rx: RegExp }[],
): CauselistEntry[] {
  type Mark = {
    s: number;
    e: number;
    caseno: string;
    isLead: boolean;
    serial: string | null;
  };
  const marks: Mark[] = [];
  for (const m of text.matchAll(LEAD_RE)) {
    marks.push({
      s: m.index! + m[0].indexOf(m[2]),
      e: m.index! + m[0].length,
      caseno: m[2],
      isLead: true,
      serial: m[1],
    });
  }
  const seen = new Set(marks.map((mk) => mk.s));
  for (const m of text.matchAll(CONN_RE)) {
    const start = m.index! + m[0].lastIndexOf(m[1]);
    if (!seen.has(start)) {
      marks.push({
        s: start,
        e: start + m[1].length,
        caseno: m[1],
        isLead: false,
        serial: null,
      });
    }
  }
  marks.sort((a, b) => a.s - b.s);
  const starts = marks.map((mk) => mk.s);

  const entries: CauselistEntry[] = [];
  const bySerial: Record<string, CauselistEntry[]> = {};
  let curSerial = "";
  let curCaption = "";

  marks.forEach((mk, idx) => {
    const segEnd = idx + 1 < starts.length ? starts[idx + 1] : text.length;
    const seg = text.slice(mk.e, segEnd);
    if (mk.isLead) {
      curSerial = mk.serial || "";
      const pre = text.slice(Math.max(0, mk.s - 240), mk.s);
      const caps = [
        ...pre.matchAll(
          /((?:[A-Z]{2,}-)?FOR\s+[A-Z][A-Za-z0-9 ,/&()\-]{0,55})/gi,
        ),
      ];
      if (caps.length) {
        curCaption = clean(caps[caps.length - 1][1]).replace(/\s+\d+$/, "");
      }
    }
    let blob = seg.split(/\bREMARK/i)[0];
    blob = blob.replace(/\[[^\]]*\]/g, " ");
    for (const p of pats) blob = blob.replace(p.rx, " ");
    blob = clean(blob);
    const mvs = blob.match(/\bV[S/]\.?\b/i);
    let parties: string;
    if (mvs && mvs.index !== undefined) {
      parties = `${short(blob.slice(0, mvs.index), 55)} v ${short(blob.slice(mvs.index + mvs[0].length), 55)}`.replace(
        /^ v | v $/g,
        "",
      );
    } else {
      parties = short(blob, 90);
    }
    const e: CauselistEntry = {
      serial: curSerial,
      caseno: mk.caseno,
      caption: curCaption,
      parties,
      advocates: matchAdvocates(seg, pats),
      connected: "",
      folded: false,
    };
    entries.push(e);
    (bySerial[curSerial] ||= []).push(e);
  });

  for (const group of Object.values(bySerial)) {
    const nums = group.map((g) => g.caseno);
    const hasSubstantive = group.some((g) => !isInterloc(g.caseno));
    for (const g of group) {
      g.connected = nums.filter((n) => n !== g.caseno).join(", ");
      g.folded = isInterloc(g.caseno) && hasSubstantive;
    }
  }
  return entries;
}

export function extractVcUrl(text: string): string {
  const raw = text.match(/https?:\/\/[^\s<>"'\)\]\\]+/gi) || [];
  const urls = raw.map((u) => u.replace(/[.,;:]+$/g, "").replace(/\\+$/g, ""));
  const hint = /vconsol|zoom\.us|meet\.google|teams\.microsoft|webex|\bvc\.|video.?conf|hcbombay/i;
  return urls.find((u) => hint.test(u)) || urls[0] || "";
}

export function listPdfFilename(input: { date: string; court: string; judge: string; list_type: string }) {
  const parts = [
    (input.date || "").replace(/-/g, ""),
    input.court ? `Court ${input.court}` : "",
    input.list_type,
    input.judge,
  ].filter(Boolean);
  return `${parts.join(" ").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 110)}.pdf`;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
