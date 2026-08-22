import type { Forum, Matter, StampReg } from "./types";
import { SIDE_LABEL, STAMP_LABEL } from "@/lib/types";
import { clockNow } from "./dates";
import { DEFAULT_CONFIG, defaultColumns, emptyDocket } from "./templates";
import { caseLabel, forumCourtName, uid } from "@/lib/utils";
import { isoFromCourt } from "./dates";

function asSteps(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (typeof s === "string") return { id: uid(), text: s, done: false, due: "", note: "" };
      if (s && typeof s === "object") {
        const o = s as Record<string, unknown>;
        return {
          id: String(o.id || uid()),
          text: String(o.text || ""),
          done: Boolean(o.done),
          due: String(o.due || ""),
          note: String(o.note || ""),
        };
      }
      return null;
    })
    .filter((s): s is NonNullable<typeof s> => !!s && !!s.text);
}

function asNotes(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => {
      if (typeof n === "string") {
        return { id: uid(), text: n, date: "", createdAt: clockNow() };
      }
      if (n && typeof n === "object") {
        const o = n as Record<string, unknown>;
        const text = String(o.text || "");
        return {
          id: String(o.id || uid()),
          text,
          date: String(o.date || ""),
          createdAt: String(o.createdAt || clockNow()),
        };
      }
      return null;
    })
    .filter((n): n is NonNullable<typeof n> => !!n && !!n.text);
}

export function trackerRowToMatter(raw: Record<string, unknown>): Matter | null {
  const forum: Forum =
    String(raw.forum || "") === "sat" ? "sat" : String(raw.forum || "") === "nclt" ? "nclt" : "bhc";
  const side = String(raw.side || "2") === "1" ? "1" : "2";
  const stampreg = (String(raw.stampreg || "R") === "S" ? "S" : "R") as StampReg;
  const caseType = String(raw.case_type || raw.caseType || "");
  const caseNo = String(raw.case_no || raw.caseNo || "");
  const year = String(raw.year || "");
  if (!caseType || !caseNo || !year) return null;
  const id =
    String(raw.id || "") ||
    (forum === "sat"
      ? ["sat", caseType, caseNo, year].join("|")
      : forum === "nclt"
        ? ["nclt", String(raw.bench || "9"), caseType, caseNo, year].join("|")
        : [side, stampreg, caseType, caseNo, year].join("|"));
  const docket = emptyDocket();
  const next: Matter = {
    ...docket,
    id,
    name: String(raw.name || "Imported matter"),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    templateId: "blank",
    config: { ...DEFAULT_CONFIG },
    columns: defaultColumns(),
    docs: [],
    deadlines: [],
    oralOutline: "",
    forum,
    bench: forum === "nclt" ? String(raw.bench || "9") : "",
    benchLabel: forum === "nclt" ? String(raw.bench_label || raw.benchLabel || "Mumbai") : "",
    side,
    sideLabel: String(
      raw.side_label ||
        raw.sideLabel ||
        (forum === "sat" ? "SAT · Mumbai" : forum === "nclt" ? "NCLT · Mumbai" : SIDE_LABEL[side]),
    ),
    stampreg,
    stampregLabel: String(raw.stampreg_label || raw.stampregLabel || STAMP_LABEL[stampreg]),
    caseType,
    typeName: String(raw.type_name || raw.typeName || ""),
    caseNo,
    year,
    petitioner: String(raw.petitioner || ""),
    respondent: String(raw.respondent || ""),
    cnr: String(raw.cnr || ""),
    filedOn: isoFromCourt(String(raw.filed_on || raw.filedOn || "")) || "",
    registrationDate: String(raw.registration_date || raw.registrationDate || ""),
    courtStatus: String(raw.status || ""),
    status: /dispos/i.test(String(raw.status || "")) ? "Disposed" : "Pending",
    disposalDate: String(raw.disposal_date || raw.disposalDate || ""),
    lodging: String(raw.lodging || ""),
    petitionerAdv: String(raw.petitioner_adv || raw.petitionerAdv || ""),
    respondentAdv: String(raw.respondent_adv || raw.respondentAdv || ""),
    stage: String(raw.stage || ""),
    act: String(raw.act || ""),
    partner: String(raw.partner || ""),
    associates: String(raw.associates || ""),
    lastListing: String(raw.last_listing || raw.lastListing || ""),
    lastCoram: String(raw.last_coram || raw.lastCoram || ""),
    nextListing: String(raw.next_listing || raw.nextListing || ""),
    lastRefresh: String(raw.last_refresh || raw.lastRefresh || ""),
    hearingNotes: asNotes(raw.hearing_notes ?? raw.hearingNotes),
    tasks: asSteps(raw.next_steps ?? raw.tasks),
    orders: Array.isArray(raw.orders)
      ? raw.orders.map((o) => {
          const x = (o || {}) as Record<string, unknown>;
          return {
            id: String(x.id || x.key || uid()),
            date: String(x.date || ""),
            title: String(x.doc || x.title || "Order"),
            coram: String(x.coram || ""),
            excerpt: String(x.excerpt || ""),
            key: x.key ? String(x.key) : undefined,
            srl: x.srl ? String(x.srl) : undefined,
            doc: x.doc ? String(x.doc) : undefined,
            downloaded: Boolean(x.downloaded),
            docId: x.docId ? String(x.docId) : undefined,
          };
        })
      : [],
    sample: false,
  };
  next.config = {
    ...DEFAULT_CONFIG,
    caseNumber: caseLabel(next),
    court: forumCourtName(next),
    hearingDate: isoFromCourt(String(raw.next_hearing || raw.nextListing || next.nextListing)) || "",
  };
  next.name = `${next.config.caseNumber} — ${next.petitioner} v ${next.respondent}`.slice(0, 80);
  return next;
}

export function parseImportPayload(json: unknown): Matter[] {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { matters?: unknown }).matters)
      ? (json as { matters: unknown[] }).matters
      : [];
  return list
    .map((row) => (row && typeof row === "object" ? trackerRowToMatter(row as Record<string, unknown>) : null))
    .filter((m): m is Matter => !!m);
}
