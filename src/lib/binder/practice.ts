import { newId } from "@/lib/utils";
import { captionFromDocket } from "./docket";
import { toIsoDate } from "./dates";
import { DEFAULT_CONFIG, emptyDocket } from "./templates";
import type { BinderConfig, Column, HearingNote, Matter, NextStep, OrderMeta } from "./types";

function iso(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toIsoDate(d);
}

function display(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function blankColumns(): Column[] {
  return [
    { id: newId(), name: "Sr No.", type: "serial", weight: 8 },
    { id: newId(), name: "Particulars", type: "text", weight: 60 },
    { id: newId(), name: "Pages", type: "pages", weight: 16 },
  ];
}

function matter(opts: {
  id: string;
  name: string;
  petitioner: string;
  respondent: string;
  stage: string;
  status: Matter["status"];
  lastCoram: string;
  lastListing: string;
  filedOn: string;
  partner: string;
  associates: string;
  tags: string[];
  court: string;
  caseNumber: string;
  hearingDate: string;
  appearingFor: string;
  docTitle: string;
  hearingNotes: HearingNote[];
  tasks: NextStep[];
  orders: OrderMeta[];
  nextListing?: string;
  courtLastDate?: string;
}): Matter {
  const now = Date.now();
  const config: BinderConfig = {
    ...DEFAULT_CONFIG,
    court: opts.court,
    caseNumber: opts.caseNumber,
    hearingDate: opts.hearingDate,
    appearingFor: opts.appearingFor,
    docTitle: opts.docTitle,
  };
  const m: Matter = {
    ...emptyDocket(),
    id: opts.id,
    name: opts.name,
    createdAt: now,
    updatedAt: now,
    templateId: "blank",
    config,
    columns: blankColumns(),
    docs: [],
    deadlines: [],
    oralOutline: "",
    petitioner: opts.petitioner,
    respondent: opts.respondent,
    stage: opts.stage,
    status: opts.status,
    lastCoram: opts.lastCoram,
    lastListing: opts.lastListing,
    filedOn: opts.filedOn,
    partner: opts.partner,
    associates: opts.associates,
    tags: opts.tags,
    hearingNotes: opts.hearingNotes,
    tasks: opts.tasks,
    orders: opts.orders,
    issues: [],
    sample: true,
    nextListing: opts.nextListing || "",
    courtLastDate: opts.courtLastDate || "",
  };
  m.config.causeTitle = captionFromDocket(m);
  return m;
}

export function makePracticeMatters(): Matter[] {
  return [
    matter({
      id: "sample-meridian",
      name: "WP/1842/2024 — Meridian Logistics v State of Maharashtra",
      petitioner: "Meridian Logistics Pvt. Ltd.",
      respondent: "State of Maharashtra & Ors.",
      stage: "Admission",
      status: "Pending",
      lastCoram: "Hon'ble Shri Justice G. S. Patel",
      lastListing: iso(-21),
      filedOn: "2024-02-12",
      partner: "N. Dahiya",
      associates: "A. Shah",
      tags: ["board today"],
      court: "High Court of Judicature at Bombay",
      caseNumber: "WP/1842/2024",
      hearingDate: iso(0),
      appearingFor: "the Petitioner",
      docTitle: "CONVENIENCE COMPILATION ON BEHALF OF THE PETITIONER",
      nextListing: display(2),
      courtLastDate: display(-21),
      hearingNotes: [
        {
          id: "n1",
          text: "Court indicated it will hear the stay application with the connected notice of motion. File the additional affidavit of the transport commissioner before the next date.",
          date: iso(-21),
          createdAt: iso(0),
        },
      ],
      tasks: [
        { id: "t1", text: "File additional affidavit of the Transport Commissioner", done: false, due: iso(0), note: "" },
        { id: "t2", text: "Serve convenience compilation on GP by 4 pm", done: false, due: iso(0), note: "" },
      ],
      orders: [
        {
          id: "o1",
          date: display(-21),
          title: "Interim order",
          coram: "Hon'ble Shri Justice G. S. Patel",
          excerpt:
            "The petition is stood over. Petitioner to file the additional affidavit within two weeks. Ad-interim protection to continue till the next date of hearing.",
        },
      ],
    }),
    matter({
      id: "sample-harbourline",
      name: "COMS/88/2023 — Harbourline Shipping v Peninsula Ports",
      petitioner: "Harbourline Shipping Ltd.",
      respondent: "Peninsula Ports Ltd.",
      stage: "Evidence",
      status: "Pending",
      lastCoram: "Hon'ble Smt. Justice Bharati Dangre",
      lastListing: iso(-14),
      filedOn: "2023-03-04",
      partner: "N. Dahiya",
      associates: "M. Iyer, R. Kapoor",
      tags: ["commercial"],
      court: "High Court of Judicature at Bombay — Commercial Division",
      caseNumber: "COMS/88/2023",
      hearingDate: iso(1),
      appearingFor: "the Plaintiff",
      docTitle: "PLAINTIFF'S CONVENIENCE COMPILATION",
      hearingNotes: [
        {
          id: "n2",
          text: "Cross of PW-1 part-heard. Mark the remaining invoices (Ex. P-14 onwards) and keep the original bills of lading ready.",
          date: iso(-14),
          createdAt: iso(0),
        },
      ],
      tasks: [
        { id: "t3", text: "Paginate remaining invoices for PW-1 cross", done: false, due: iso(1), note: "" },
        { id: "t4", text: "Confirm witness is available at 11 am", done: true, due: iso(-1), note: "" },
      ],
      orders: [
        {
          id: "o2",
          date: display(-14),
          title: "Farad order",
          coram: "Hon'ble Smt. Justice Bharati Dangre",
          excerpt: "",
        },
      ],
    }),
    matter({
      id: "sample-sterling",
      name: "CARBP/15/2025 — Sterling Infra v Western Grid",
      petitioner: "Sterling Infra Projects LLP",
      respondent: "Western Grid Corporation",
      stage: "Section 9",
      status: "Pending",
      lastCoram: "Hon'ble Shri Justice B. P. Colabawalla",
      lastListing: iso(-30),
      filedOn: "2025-01-19",
      partner: "K. Mehta",
      associates: "A. Shah",
      tags: ["arb"],
      court: "High Court of Judicature at Bombay",
      caseNumber: "CARBP/15/2025",
      hearingDate: iso(5),
      appearingFor: "the Petitioner",
      docTitle: "COMPILATION OF JUDGEMENTS ON BEHALF OF THE PETITIONER",
      hearingNotes: [],
      tasks: [
        { id: "t5", text: "Update note on bank guarantee invocation", done: false, due: iso(3), note: "" },
      ],
      orders: [
        {
          id: "o3",
          date: display(-30),
          title: "Interim order",
          coram: "Hon'ble Shri Justice B. P. Colabawalla",
          excerpt:
            "Status quo in respect of the two performance bank guarantees until the next date. Petitioner to serve the complete compilation on the respondent.",
        },
      ],
    }),
    matter({
      id: "sample-leela",
      name: "ASWP/402/2022 — Smt. Leela Narayan v MCGM",
      petitioner: "Smt. Leela Narayan",
      respondent: "Municipal Corporation of Greater Mumbai",
      stage: "Disposed",
      status: "Disposed",
      lastCoram: "Hon'ble the Chief Justice & Hon'ble Shri Justice M. S. Sonak",
      lastListing: iso(-40),
      filedOn: "2022-06-08",
      partner: "K. Mehta",
      associates: "",
      tags: ["disposed"],
      court: "High Court of Judicature at Bombay — Appellate Side",
      caseNumber: "ASWP/402/2022",
      hearingDate: "",
      appearingFor: "the Petitioner",
      docTitle: "",
      hearingNotes: [
        {
          id: "n3",
          text: "Rule made absolute in part. MCGM to re-hear the demolition notice within eight weeks. Collect certified copy.",
          date: iso(-40),
          createdAt: iso(0),
        },
      ],
      tasks: [
        { id: "t6", text: "Apply for certified copy of the judgment", done: false, due: iso(-10), note: "" },
      ],
      orders: [
        {
          id: "o4",
          date: display(-40),
          title: "Judgment",
          coram: "Hon'ble the Chief Justice",
          excerpt: "",
        },
      ],
    }),
  ];
}
