import { newId } from "@/lib/utils";
import { captionFromDocket, partyCaption } from "./docket";
import type { BinderConfig, Column, CourtTemplate, Matter } from "./types";

export const DEFAULT_CONFIG: BinderConfig = {
  causeTitle: "",
  docTitle: "",
  indexHeading: "INDEX",
  fontFamily: "times",
  baseSize: 12,
  pageSize: "a4",
  pageNum: { size: 20, bold: true, pos: "tr" },
  headerFill: "#D9D9D9",
  borders: true,
  court: "",
  caseNumber: "",
  hearingDate: "",
  appearingFor: "",
  filedBy: "",
  numberingMode: "continuous",
  batesPrefix: "",
  watermark: "none",
  gutterMm: 0,
  runningHeader: false,
  hyperlinkIndex: true,
  volumeMaxPages: 0,
  separatorSheets: false,
  certificatePage: false,
  exhibitScheme: "none",
};

const GENERIC_COLUMNS: Omit<Column, "id">[] = [
  { name: "Sr No.", type: "serial", weight: 8 },
  { name: "Particulars", type: "text", weight: 60 },
  { name: "Pages", type: "pages", weight: 16 },
];

export const TEMPLATES: CourtTemplate[] = [
  {
    id: "nclt-compilation",
    name: "NCLT compilation",
    blurb: "Judgement compilation for an I.A. in a company petition — only if that is your forum.",
    tile: "cyan",
    config: {
      court: "National Company Law Tribunal",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE APPLICANT",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE NATIONAL COMPANY LAW TRIBUNAL**",
        "**[BENCH] BENCH, AT [CITY]**",
        "",
        "**I.A. NO. [___] OF 20[__]**",
        "**IN**",
        "**COMPANY PETITION IB (IBC) NO. [___]/[BENCH]/20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Petitioner]\t…Petitioner",
        "versus",
        "L:[Name of Respondent]\t…Respondent",
        "",
        "L:**AND IN THE MATTER OF:**",
        "L:[Name of Applicant]\t…Applicant",
        "versus",
        "L:[Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 7 },
      { name: "Judgement Particulars", type: "case", weight: 59 },
      { name: "Relevant Paras", type: "text", weight: 22 },
      { name: "Page Nos.", type: "pages", weight: 12 },
    ],
  },
  {
    id: "nclat-appeal",
    name: "NCLAT appeal",
    blurb: "Convenience compilation for an appellate hearing.",
    tile: "cobalt",
    config: {
      court: "National Company Law Appellate Tribunal",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE APPELLANT",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE NATIONAL COMPANY LAW APPELLATE TRIBUNAL**",
        "**PRINCIPAL BENCH, NEW DELHI**",
        "",
        "**COMPANY APPEAL (AT) (INS.) NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Appellant]\t…Appellant",
        "versus",
        "L:[Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 7 },
      { name: "Particulars", type: "case", weight: 58 },
      { name: "Paras to be read", type: "text", weight: 23 },
      { name: "Pages", type: "pages", weight: 12 },
    ],
  },
  {
    id: "sci-slp",
    name: "Supreme Court SLP",
    blurb: "Compilation of judgements for a special leave petition.",
    tile: "teal",
    config: {
      court: "Supreme Court of India",
      docTitle: "COMPILATION OF JUDGEMENTS",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**IN THE SUPREME COURT OF INDIA**",
        "**CIVIL / CRIMINAL APPELLATE JURISDICTION**",
        "",
        "**SPECIAL LEAVE PETITION (C) NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Petitioner]\t…Petitioner",
        "versus",
        "L:[Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 7 },
      { name: "Citation", type: "case", weight: 60 },
      { name: "Propositions", type: "text", weight: 21 },
      { name: "Pages", type: "pages", weight: 12 },
    ],
  },
  {
    id: "hc-writ",
    name: "High Court writ",
    blurb: "Authorities and annexures for a writ petition.",
    tile: "emerald",
    config: {
      court: "High Court",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE PETITIONER",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**IN THE HIGH COURT OF [STATE]**",
        "**AT [CITY]**",
        "",
        "**WRIT PETITION NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Petitioner]\t…Petitioner",
        "versus",
        "L:[Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 7 },
      { name: "Particulars", type: "case", weight: 55 },
      { name: "Annexure", type: "exhibit", weight: 14 },
      { name: "Pages", type: "pages", weight: 12 },
    ],
  },
  {
    id: "delhi-commercial",
    name: "Delhi commercial",
    blurb: "Commercial Division / Commercial Court hearing bundle.",
    tile: "cobalt",
    config: {
      court: "High Court of Delhi — Commercial Division",
      docTitle: "PLAINTIFF'S / DEFENDANT'S CONVENIENCE COMPILATION",
      indexHeading: "INDEX",
      pageSize: "a4",
      gutterMm: 12,
      runningHeader: true,
      causeTitle: [
        "**IN THE HIGH COURT OF DELHI AT NEW DELHI**",
        "**COMMERCIAL DIVISION**",
        "",
        "**CS (COMM) NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Plaintiff]\t…Plaintiff",
        "versus",
        "L:[Name of Defendant]\t…Defendant",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Particulars", type: "case", weight: 56 },
      { name: "Propositions", type: "text", weight: 22 },
      { name: "Pages", type: "pages", weight: 14 },
    ],
  },
  {
    id: "trial-evidence",
    name: "Trial evidence",
    blurb: "Exhibit binder for a district or commercial court trial.",
    tile: "crimson",
    config: {
      court: "District Court",
      docTitle: "PLAINTIFF'S / DEFENDANT'S EXHIBIT BINDER",
      indexHeading: "LIST OF EXHIBITS",
      pageSize: "a4",
      exhibitScheme: "letters",
      separatorSheets: true,
      causeTitle: [
        "**IN THE COURT OF [DESIGNATION], [CITY]**",
        "",
        "**C.S. / COMM. SUIT NO. [___] OF 20[__]**",
        "",
        "L:[Name of Plaintiff]\t…Plaintiff",
        "versus",
        "L:[Name of Defendant]\t…Defendant",
      ].join("\n"),
    },
    columns: [
      { name: "Ex.", type: "exhibit", weight: 10 },
      { name: "Description", type: "text", weight: 58 },
      { name: "Date", type: "date", weight: 16 },
      { name: "Pages", type: "pages", weight: 16 },
    ],
  },
  {
    id: "arbitration",
    name: "Arbitration",
    blurb: "Hearing bundle for a seated arbitration.",
    tile: "steel",
    config: {
      court: "Arbitral Tribunal",
      docTitle: "CLAIMANT'S / RESPONDENT'S HEARING BUNDLE",
      indexHeading: "INDEX TO THE BUNDLE",
      pageSize: "a4",
      numberingMode: "docsOnly",
      batesPrefix: "",
      gutterMm: 12,
      runningHeader: true,
      causeTitle: [
        "**IN THE MATTER OF AN ARBITRATION**",
        "**UNDER THE [RULES]**",
        "",
        "**ARBITRATION NO. [___] OF 20[__]**",
        "",
        "L:**BETWEEN**",
        "L:[Name of Claimant]\t…Claimant",
        "and",
        "L:[Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Tab", type: "serial", weight: 8 },
      { name: "Document", type: "text", weight: 56 },
      { name: "Date", type: "date", weight: 18 },
      { name: "Pages", type: "pages", weight: 18 },
    ],
  },
  {
    id: "written-subs",
    name: "Written submissions",
    blurb: "Authorities cited in notes of argument / written submissions.",
    tile: "teal",
    config: {
      court: "",
      docTitle: "COMPILATION OF AUTHORITIES CITED IN THE WRITTEN SUBMISSIONS",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE [COURT / TRIBUNAL]**",
        "",
        "**[CASE NUMBER]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Parties]",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Authority", type: "case", weight: 52 },
      { name: "Proposition", type: "text", weight: 28 },
      { name: "Pages", type: "pages", weight: 12 },
    ],
  },
  {
    id: "to-be-read",
    name: "To be read",
    blurb: "Thin convenience volume of authorities that will actually be opened.",
    tile: "cyan",
    config: {
      court: "",
      docTitle: "CONVENIENCE COMPILATION OF JUDGEMENTS TO BE READ",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE [COURT / TRIBUNAL]**",
        "",
        "**[CASE NUMBER]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Parties]",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Authority", type: "case", weight: 62 },
      { name: "Paras", type: "text", weight: 18 },
      { name: "Pages", type: "pages", weight: 12 },
    ],
  },
  {
    id: "criminal-appeal",
    name: "Criminal appeal",
    blurb: "Convenience compilation for a criminal appeal or revision.",
    tile: "crimson",
    config: {
      court: "High Court",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE APPELLANT",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**IN THE HIGH COURT OF [STATE]**",
        "**CRIMINAL APPELLATE JURISDICTION**",
        "",
        "**CRIMINAL APPEAL NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Appellant]\t…Appellant",
        "versus",
        "L:[State / Name of Respondent]\t…Respondent",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Citation", type: "case", weight: 58 },
      { name: "Paras", type: "text", weight: 20 },
      { name: "Pages", type: "pages", weight: 14 },
    ],
  },
  {
    id: "drt",
    name: "DRT / DRAT",
    blurb: "Recovery proceedings and securitisation appeals.",
    tile: "steel",
    config: {
      court: "Debts Recovery Tribunal",
      docTitle: "COMPILATION OF JUDGEMENTS",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE DEBTS RECOVERY TRIBUNAL**",
        "**[CITY]**",
        "",
        "**O.A. NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Applicant]\t…Applicant",
        "versus",
        "L:[Name of Defendant]\t…Defendant",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Particulars", type: "case", weight: 58 },
      { name: "Paras", type: "text", weight: 20 },
      { name: "Pages", type: "pages", weight: 14 },
    ],
  },
  {
    id: "consumer",
    name: "Consumer commission",
    blurb: "District / State / National Consumer Disputes Redressal.",
    tile: "emerald",
    config: {
      court: "Consumer Disputes Redressal Commission",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE COMPLAINANT",
      indexHeading: "INDEX",
      pageSize: "a4",
      causeTitle: [
        "**BEFORE THE [DISTRICT / STATE / NATIONAL] CONSUMER DISPUTES REDRESSAL COMMISSION**",
        "**AT [CITY]**",
        "",
        "**CONSUMER COMPLAINT NO. [___] OF 20[__]**",
        "",
        "L:**IN THE MATTER OF:**",
        "L:[Name of Complainant]\t…Complainant",
        "versus",
        "L:[Name of Opposite Party]\t…Opposite Party",
      ].join("\n"),
    },
    columns: [
      { name: "Sr No.", type: "serial", weight: 8 },
      { name: "Authority", type: "case", weight: 58 },
      { name: "Paras", type: "text", weight: 20 },
      { name: "Pages", type: "pages", weight: 14 },
    ],
  },
  {
    id: "us-exhibit",
    name: "US exhibit binder",
    blurb: "Federal / state exhibit volume with Bates numbers.",
    tile: "cobalt",
    config: {
      court: "United States District Court",
      docTitle: "PLAINTIFF'S EXHIBIT BINDER",
      indexHeading: "EXHIBIT INDEX",
      pageSize: "letter",
      exhibitScheme: "letters",
      batesPrefix: "P",
      numberingMode: "docsOnly",
      separatorSheets: true,
      gutterMm: 15,
      causeTitle: [
        "**IN THE UNITED STATES DISTRICT COURT**",
        "**FOR THE [DISTRICT]**",
        "",
        "**[CAPTION]**",
        "",
        "Case No. [___]",
      ].join("\n"),
    },
    columns: [
      { name: "Ex.", type: "exhibit", weight: 10 },
      { name: "Description", type: "text", weight: 54 },
      { name: "Date", type: "date", weight: 16 },
      { name: "Bates", type: "pages", weight: 20 },
    ],
  },
];

export function columnsFrom(t: CourtTemplate): Column[] {
  return t.columns.map((c) => ({ ...c, id: newId() }));
}

export function configFrom(t: CourtTemplate): BinderConfig {
  return { ...DEFAULT_CONFIG, ...t.config };
}

export function defaultColumns(): Column[] {
  return GENERIC_COLUMNS.map((c) => ({ ...c, id: newId() }));
}

export function emptyDocket(): Pick<
  Matter,
  | "petitioner"
  | "respondent"
  | "stage"
  | "status"
  | "lastCoram"
  | "lastListing"
  | "filedOn"
  | "partner"
  | "associates"
  | "tags"
  | "hearingNotes"
  | "tasks"
  | "orders"
  | "issues"
  | "sample"
> {
  return {
    petitioner: "",
    respondent: "",
    stage: "",
    status: "Pending",
    lastCoram: "",
    lastListing: "",
    filedOn: "",
    partner: "",
    associates: "",
    tags: [],
    hearingNotes: [],
    tasks: [],
    orders: [],
    issues: [],
    sample: false,
  };
}

export function matterNameFrom(m: Matter): string {
  const parties = partyCaption(m);
  const cn = m.config.caseNumber.trim();
  if (m.petitioner.trim() || m.respondent.trim()) {
    return (cn ? `${cn} — ${parties}` : parties).slice(0, 80);
  }
  const title = m.config.docTitle.trim();
  if (cn && title) return `${cn} — ${title}`.slice(0, 80);
  if (title) return title.slice(0, 80);
  if (cn) return cn.slice(0, 80);
  return m.name || "New matter";
}

export function createMatter(template?: CourtTemplate): Matter {
  if (!template) return blankMatter();
  const now = Date.now();
  const config = configFrom(template);
  return {
    id: newId(),
    name: template.name,
    createdAt: now,
    updatedAt: now,
    templateId: template.id,
    config,
    columns: columnsFrom(template),
    docs: [],
    deadlines: [],
    oralOutline: "",
    ...emptyDocket(),
  };
}

export function blankMatter(): Matter {
  const now = Date.now();
  const m: Matter = {
    id: newId(),
    name: "New matter",
    createdAt: now,
    updatedAt: now,
    templateId: "blank",
    config: {
      ...DEFAULT_CONFIG,
      docTitle: "",
      causeTitle: "",
    },
    columns: defaultColumns(),
    docs: [],
    deadlines: [],
    oralOutline: "",
    ...emptyDocket(),
  };
  return m;
}

export function stampCaption(m: Matter): void {
  m.config.causeTitle = captionFromDocket(m);
}
