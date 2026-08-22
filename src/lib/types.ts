export type Side = "1" | "2";
export type StampReg = "R" | "S";
export type Forum = "bhc" | "sat" | "nclt";

export type LookupParams = {
  forum?: Forum;
  bench?: string;
  side: string;
  stampreg: StampReg;
  case_type: string;
  case_no: string;
  year: string;
};

export type CaseType = {
  value: string;
  label: string;
};

export type NextStep = {
  id: string;
  text: string;
  done: boolean;
  due: string;
};

export type HearingNote = {
  id: string;
  text: string;
  date: string;
  createdAt: string;
};

export type OrderMeta = {
  key: string;
  srl: string;
  date: string;
  doc: string;
  coram: string;
  downloaded: boolean;
  excerpt?: string;
};

export type Matter = {
  id: string;
  forum?: Forum;
  bench?: string;
  bench_label?: string;
  side: Side;
  side_label: string;
  stampreg: StampReg;
  stampreg_label: string;
  case_type: string;
  type_name: string;
  case_no: string;
  year: string;
  petitioner: string;
  respondent: string;
  cnr: string;
  filed_on: string;
  registration_date: string;
  status: string;
  disposal_date: string;
  lodging: string;
  petitioner_adv: string;
  respondent_adv: string;
  stage: string;
  act: string;
  partner: string;
  associates: string;
  next_hearing: string;
  next_listing: string;
  last_listing: string;
  last_coram: string;
  hearing_notes: HearingNote[];
  next_steps: NextStep[];
  tags: string[];
  order_count: number;
  orders: OrderMeta[];
  added_at: string;
  last_refresh: string;
  last_added: number;
  sample?: boolean;
};

export type ListingRow = {
  date: string;
  date_full: string;
  date_ddmm: string;
  matter: string;
  number: string;
  serial: string;
  list_type: string;
  judge: string;
  court: string;
  caption: string;
  connected: string;
  reasons: string[];
  tracked: boolean;
  mid?: string | null;
  source?: Forum;
  href?: string;
  add?: {
    forum?: Forum;
    abbr: string;
    stampreg: StampReg;
    no: string;
    year: string;
    bench?: string;
  } | null;
};

export type ListingsState = {
  generated_at: string;
  days: { date: string; short: string; full: string }[];
  range_label: string;
  num_days: number;
  rows: ListingRow[];
  scanning?: boolean;
};

export type TrackerSettings = {
  watched: string[];
  scan_days: number;
  notify: boolean;
  orderRoot: string;
  orderNamePattern: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  kind: "add" | "refresh" | "scan" | "task" | "note" | "import" | "download";
  title: string;
  detail?: string;
};

export type CourtLookup = {
  petitioner: string;
  respondent: string;
  cnr: string;
  filed_on: string;
  registration_date: string;
  status: string;
  disposal_date: string;
  lodging: string;
  next_listing: string;
  petitioner_adv: string;
  respondent_adv: string;
  stage: string;
  act: string;
  last_coram: string;
  orders: Omit<OrderMeta, "downloaded" | "excerpt">[];
};

export const SIDE_LABEL: Record<Side, string> = {
  "1": "Appellate Side",
  "2": "Original Side",
};

export const STAMP_LABEL: Record<StampReg, string> = {
  R: "Register",
  S: "Stamp",
};

export const SAT_APPEAL_TYPES: { value: string; label: string }[] = [
  { value: "1", label: "SEBI" },
  { value: "2", label: "IRDAI" },
  { value: "3", label: "PFRDA" },
];

export const NCLT_BENCHES: { value: string; label: string }[] = [
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
];

export const NCLT_CASE_TYPES: { value: string; label: string }[] = [
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
];

export const DEFAULT_ORDER_PATTERN = "{seq} {date} {pet} v {resp}";

export const DEFAULT_SETTINGS: TrackerSettings = {
  watched: ["Bharucha & Partners", "Advani & Co.", "Advani Law LLP"],
  scan_days: 5,
  notify: true,
  orderRoot: "",
  orderNamePattern: DEFAULT_ORDER_PATTERN,
};
