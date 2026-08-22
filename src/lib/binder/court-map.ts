import type { CourtLookup, LookupParams } from "@/lib/types";
import { NCLT_BENCHES, SIDE_LABEL, STAMP_LABEL } from "@/lib/types";
import { clockNow, isoFromCourt } from "./dates";
import { DEFAULT_CONFIG, defaultColumns, emptyDocket } from "./templates";
import type { Forum, Matter, OrderMeta, StampReg } from "./types";
import { caseLabel, forumCourtName } from "@/lib/utils";

export function matterFromLookup(
  params: LookupParams & { type_name: string },
  lookup: CourtLookup,
  existing?: Matter,
): Matter {
  const newest = [...lookup.orders].sort((a, b) => {
    const pa = a.date.split("/").reverse().join("");
    const pb = b.date.split("/").reverse().join("");
    return pb.localeCompare(pa);
  })[0];
  const forum: Forum = params.forum === "sat" ? "sat" : params.forum === "nclt" ? "nclt" : "bhc";
  const caseNo =
    forum === "sat"
      ? String(params.case_no).replace(/\D/g, "").padStart(4, "0")
      : params.case_no;
  const ncltBench = NCLT_BENCHES.find((b) => b.value === (params.bench || "9"))?.label || "Mumbai";
  const id =
    existing?.id ||
    (forum === "sat"
      ? ["sat", params.case_type, caseNo, params.year].join("|")
      : forum === "nclt"
        ? ["nclt", params.bench || "9", params.case_type, caseNo, params.year].join("|")
        : [params.side, params.stampreg, params.case_type, params.case_no, params.year].join("|"));

  const docket = emptyDocket();
  const side = (forum === "bhc" ? params.side : existing?.side || "2") as Matter["side"];
  const stampreg = (params.stampreg || existing?.stampreg || "R") as StampReg;
  const next: Matter = {
    ...docket,
    id,
    name: existing?.name || "New matter",
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    templateId: existing?.templateId || "blank",
    config: { ...(existing?.config ?? DEFAULT_CONFIG) },
    columns: existing?.columns?.length ? existing.columns : defaultColumns(),
    docs: existing?.docs ?? [],
    deadlines: existing?.deadlines ?? [],
    oralOutline: existing?.oralOutline ?? "",
    forum,
    bench: forum === "nclt" ? params.bench || "9" : existing?.bench || "",
    benchLabel: forum === "nclt" ? ncltBench : existing?.benchLabel || "",
    side,
    sideLabel:
      forum === "sat"
        ? "SAT · Mumbai"
        : forum === "nclt"
          ? `NCLT · ${ncltBench}`
          : SIDE_LABEL[side === "1" ? "1" : "2"] || params.side,
    stampreg,
    stampregLabel:
      forum === "sat"
        ? params.type_name.split(" - ")[0] || "Appeal"
        : forum === "nclt"
          ? params.type_name.split(" (")[0] || "Petition"
          : STAMP_LABEL[stampreg],
    caseType: params.case_type,
    typeName: params.type_name,
    caseNo,
    year: params.year,
    petitioner: lookup.petitioner || existing?.petitioner || "",
    respondent: lookup.respondent || existing?.respondent || "",
    cnr: lookup.cnr || "",
    filedOn: isoFromCourt(lookup.filed_on) || existing?.filedOn || "",
    registrationDate: lookup.registration_date || "",
    courtStatus: lookup.status || "",
    status: /dispos/i.test(lookup.status) ? "Disposed" : "Pending",
    disposalDate: lookup.disposal_date || "",
    lodging: lookup.lodging || "",
    petitionerAdv: lookup.petitioner_adv || "",
    respondentAdv: lookup.respondent_adv || "",
    stage: lookup.stage || existing?.stage || "",
    act: lookup.act || "",
    lastListing: newest?.date || existing?.lastListing || "",
    lastCoram: newest?.coram || lookup.last_coram || existing?.lastCoram || "",
    nextListing: lookup.next_listing || existing?.nextListing || "",
    lastRefresh: clockNow(),
    hearingNotes: existing?.hearingNotes ?? [],
    tasks: existing?.tasks ?? [],
    tags: existing?.tags ?? [],
    partner: existing?.partner || "",
    associates: existing?.associates || "",
    issues: existing?.issues ?? [],
    orders: mergeOrders(lookup, existing),
    sample: false,
  };

  const label = caseLabel(next);
  const courtName = forumCourtName(next);
  const courtIso = isoFromCourt(lookup.next_listing);
  const prevCourtIso = isoFromCourt(existing?.nextListing);
  next.config = {
    ...(existing?.config ?? DEFAULT_CONFIG),
    caseNumber: label || existing?.config.caseNumber || "",
    court: courtName || existing?.config.court || "",
    hearingDate:
      courtIso && (!existing?.config.hearingDate || existing.config.hearingDate === prevCourtIso)
        ? courtIso
        : existing?.config.hearingDate || courtIso || "",
  };
  return next;
}

function mergeOrders(lookup: CourtLookup, existing?: Matter): OrderMeta[] {
  const fetched = lookup.orders.map((o) => {
    const prev = existing?.orders.find((x) => x.key === o.key);
    return {
      id: prev?.id || o.key,
      date: o.date,
      title: o.doc || "Order",
      coram: o.coram,
      excerpt: prev?.excerpt || "",
      key: o.key,
      srl: o.srl,
      doc: o.doc,
      downloaded: prev?.downloaded ?? Boolean(prev?.docId),
      docId: prev?.docId,
    };
  });
  const keys = new Set(fetched.map((o) => o.key).filter(Boolean));
  const manual = (existing?.orders ?? []).filter((o) => !o.key || !keys.has(o.key));
  return [...fetched, ...manual];
}

export function lookupParamsOf(m: Matter) {
  return {
    forum: (m.forum === "sat" ? "sat" : m.forum === "nclt" ? "nclt" : "bhc") as Forum,
    bench: m.bench || undefined,
    side: m.side || "2",
    stampreg: (m.stampreg || "R") as StampReg,
    case_type: m.caseType,
    case_no: m.caseNo,
    year: m.year,
    type_name: m.typeName,
  };
}
