export type ColumnType = "serial" | "text" | "case" | "pages" | "date" | "exhibit";

export type PageSize = "letter" | "a4" | "legal";
export type FontFamily = "times" | "helvetica";
export type PageNumPos = "tr" | "tc" | "br" | "bc";
export type NumberingMode = "continuous" | "romanCover" | "docsOnly";
export type Watermark =
  | "none"
  | "draft"
  | "confidential"
  | "privilege"
  | "notForCirculation";
export type ExhibitScheme = "none" | "letters" | "arabic" | "roman" | "annexure";
export type AccentId = "cyan" | "cobalt" | "teal" | "emerald" | "crimson" | "steel";
export type PaperKind =
  | "authority"
  | "pleading"
  | "exhibit"
  | "correspondence"
  | "order"
  | "affidavit"
  | "other";
export type MatterStatus = "Pending" | "Disposed" | "";
export type Forum = "bhc" | "sat" | "nclt";
export type Side = "1" | "2";
export type StampReg = "R" | "S";

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  weight: number;
}

export interface CaseValue {
  name: string;
  cite: string;
}

export type FieldValue = string | CaseValue;

export function isCaseValue(v: FieldValue | undefined): v is CaseValue {
  return !!v && typeof v === "object" && "name" in v;
}

export interface BinderDoc {
  id: string;
  filename: string;
  pageCount: number;
  fields: Record<string, FieldValue>;
  bookmark: string;
  autoBk: boolean;
  pageFrom: number | null;
  pageTo: number | null;
  flagged: boolean;
  notes: string;
  exhibit: string;
  kind: PaperKind;
  hash: string;
  searchText: string;
  holding: string;
}

export interface PageNumConfig {
  size: number;
  bold: boolean;
  pos: PageNumPos;
}

export interface Deadline {
  id: string;
  label: string;
  date: string;
  note: string;
}

export interface NextStep {
  id: string;
  text: string;
  done: boolean;
  due: string;
  note: string;
}

export interface HearingNote {
  id: string;
  text: string;
  date: string;
  createdAt: string;
}

export interface OrderMeta {
  id: string;
  date: string;
  title: string;
  coram: string;
  excerpt: string;
  key?: string;
  srl?: string;
  doc?: string;
  downloaded?: boolean;
  docId?: string;
  diskPath?: string;
}

export interface Issue {
  id: string;
  text: string;
  note: string;
  docIds: string[];
}

export interface BinderConfig {
  causeTitle: string;
  docTitle: string;
  indexHeading: string;
  fontFamily: FontFamily;
  baseSize: number;
  pageSize: PageSize;
  pageNum: PageNumConfig;
  headerFill: string;
  borders: boolean;
  court: string;
  caseNumber: string;
  hearingDate: string;
  appearingFor: string;
  filedBy: string;
  numberingMode: NumberingMode;
  batesPrefix: string;
  watermark: Watermark;
  gutterMm: number;
  runningHeader: boolean;
  hyperlinkIndex: boolean;
  volumeMaxPages: number;
  separatorSheets: boolean;
  certificatePage: boolean;
  exhibitScheme: ExhibitScheme;
}

export interface Matter {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  templateId: string;
  config: BinderConfig;
  columns: Column[];
  docs: BinderDoc[];
  deadlines: Deadline[];
  oralOutline: string;
  petitioner: string;
  respondent: string;
  stage: string;
  status: MatterStatus;
  lastCoram: string;
  lastListing: string;
  filedOn: string;
  partner: string;
  associates: string;
  tags: string[];
  hearingNotes: HearingNote[];
  tasks: NextStep[];
  orders: OrderMeta[];
  issues: Issue[];
  sample?: boolean;
  forum?: Forum;
  bench: string;
  benchLabel: string;
  side?: Side;
  sideLabel: string;
  stampreg?: StampReg;
  stampregLabel: string;
  caseType: string;
  typeName: string;
  caseNo: string;
  year: string;
  cnr: string;
  lodging: string;
  petitionerAdv: string;
  respondentAdv: string;
  act: string;
  disposalDate: string;
  registrationDate: string;
  nextListing: string;
  lastRefresh: string;
  courtStatus: string;
  courtLastDate: string;
  orderFolder: string;
  orderNamePattern: string;
}

export interface CourtTemplate {
  id: string;
  name: string;
  blurb: string;
  tile: "cyan" | "cobalt" | "teal" | "emerald" | "crimson" | "steel";
  config: Partial<BinderConfig>;
  columns: Omit<Column, "id">[];
}

export interface LinkSlot {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  docIndex: number;
}

export interface VolumeFile {
  name: string;
  filename: string;
  bytes: Uint8Array;
  pages: number;
}

export interface BuildResult {
  bytes: Uint8Array;
  ranges: string[];
  coverPages: number;
  total: number;
  volumes?: VolumeFile[];
}

export const ACCENTS: Record<AccentId, string> = {
  cyan: "#1BA1E2",
  cobalt: "#0050EF",
  teal: "#00ABA9",
  emerald: "#008A00",
  crimson: "#A20025",
  steel: "#647687",
};

export const ACCENT_LABELS: Record<AccentId, string> = {
  cyan: "Cyan",
  cobalt: "Cobalt",
  teal: "Teal",
  emerald: "Emerald",
  crimson: "Crimson",
  steel: "Steel",
};

export const TYPE_LABELS: Record<ColumnType, string> = {
  serial: "Auto serial (1., 2., …)",
  case: "Case name + citation",
  text: "Free text (per document)",
  pages: "Auto page range",
  date: "Date (per document)",
  exhibit: "Exhibit / annexure mark",
};

export const KIND_LABELS: Record<PaperKind, string> = {
  authority: "Authority",
  pleading: "Pleading",
  exhibit: "Exhibit",
  correspondence: "Correspondence",
  order: "Order / award",
  affidavit: "Affidavit",
  other: "Other",
};

export const WATERMARK_TEXT: Record<Exclude<Watermark, "none">, string> = {
  draft: "DRAFT",
  confidential: "CONFIDENTIAL",
  privilege: "PRIVILEGED & CONFIDENTIAL",
  notForCirculation: "NOT FOR CIRCULATION",
};

export function effectivePages(doc: BinderDoc): number {
  if (doc.pageFrom && doc.pageTo) {
    const from = Math.max(1, doc.pageFrom);
    const to = Math.min(doc.pageCount, doc.pageTo);
    return Math.max(0, to - from + 1);
  }
  return doc.pageCount;
}

export function pageIndices(doc: BinderDoc): number[] {
  const n = doc.pageCount;
  if (doc.pageFrom && doc.pageTo) {
    const from = Math.max(1, doc.pageFrom);
    const to = Math.min(n, doc.pageTo);
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(i - 1);
    return out;
  }
  return Array.from({ length: n }, (_, i) => i);
}

export function blankDoc(partial: Partial<BinderDoc> & Pick<BinderDoc, "id" | "filename" | "pageCount">): BinderDoc {
  return {
    fields: {},
    bookmark: "",
    autoBk: true,
    pageFrom: null,
    pageTo: null,
    flagged: false,
    notes: "",
    exhibit: "",
    kind: "other",
    hash: "",
    searchText: "",
    holding: "",
    ...partial,
  };
}
