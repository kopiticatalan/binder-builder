import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { newId } from "@/lib/utils";
import type { BinderDoc, Column } from "./types";
import { blankDoc } from "./types";
import { guessFields } from "./guess";

const CASES = [
  {
    filename: "Innoventive Industries Ltd. v. ICICI Bank, (2018) 1 SCC 407.pdf",
    name: "Innoventive Industries Ltd. v. ICICI Bank",
    cite: "(2018) 1 SCC 407",
    paras: "27 – 33",
    date: "31 Aug 2017",
    pageFrom: 2,
    pageTo: 3,
    holding:
      "Once an insolvency petition is admitted, a moratorium under Section 14 of the Code comes into effect. State legislation cannot stand in the way of the Code, which is a later central enactment occupying the field.",
    pages: [
      [
        "REPORTABLE",
        "IN THE SUPREME COURT OF INDIA",
        "CIVIL APPELLATE JURISDICTION",
        "CIVIL APPEAL NOS. 8337–8338 OF 2017",
        "",
        "INNOVENTIVE INDUSTRIES LTD.  …Appellant",
        "versus",
        "ICICI BANK & ANR.  …Respondents",
        "",
        "JUDGMENT",
        "",
        "A two-judge bench considered the interplay between the Maharashtra Relief Undertakings (Special Provisions) Act, 1958 and the Insolvency and Bankruptcy Code, 2016.",
        "",
        "The corporate debtor had obtained a relief-undertaking notification after default. The question was whether that state law could stall a Section 7 petition once the Code had come into force.",
      ],
      [
        "27. The non-obstante clause in Section 238 of the Code is of wide amplitude. Parliament has provided that the Code shall have effect notwithstanding anything inconsistent contained in any other law for the time being in force.",
        "",
        "28. Once the Adjudicating Authority is satisfied that a default has occurred, the application must be admitted unless it is incomplete. The moratorium under Section 14 then springs into action by operation of law.",
        "",
        "29. A state enactment which suspends liabilities of a relief undertaking cannot, after the Code, interdict that process. The later central law occupies the field.",
        "",
        "30. Any other reading would permit a state notification to defeat a complete code enacted to reorganise insolvency resolution in a time-bound manner.",
      ],
      [
        "31. The moratorium is not a discretionary stay. It is the statutory consequence of admission, intended to keep the corporate debtor as a going concern while claims are collected.",
        "",
        "32. Conflicts between the Maharashtra Act and the Code must be resolved in favour of the Code. Section 238 admits of no other conclusion on the facts of this appeal.",
        "",
        "33. The appeals are accordingly dismissed. The NCLT will proceed with the corporate insolvency resolution process in accordance with the Code.",
        "",
        "Use this authority for the primacy of the Code over inconsistent state statutes and for what follows from admission under Section 7.",
      ],
    ],
  },
  {
    filename: "Swiss Ribbons Pvt. Ltd. v. Union of India, (2019) 4 SCC 17.pdf",
    name: "Swiss Ribbons Pvt. Ltd. v. Union of India",
    cite: "(2019) 4 SCC 17",
    paras: "43 – 52",
    date: "25 Jan 2019",
    pageFrom: 2,
    pageTo: 3,
    holding:
      "The Code is a beneficial legislation which puts the corporate debtor back on its feet, not a mere recovery legislation for creditors. Distinguishing financial and operational creditors is based on intelligible differentia.",
    pages: [
      [
        "REPORTABLE",
        "IN THE SUPREME COURT OF INDIA",
        "WRIT PETITION (CIVIL) NO. 99 OF 2018",
        "",
        "SWISS RIBBONS PVT. LTD. & ANR.  …Petitioners",
        "versus",
        "UNION OF INDIA & ORS.  …Respondents",
        "",
        "JUDGMENT",
        "",
        "A constitutional challenge to various provisions of the Insolvency and Bankruptcy Code, 2016 was rejected. The Court examined the object of the Code, the distinction between financial and operational creditors, and the limited role of the Adjudicating Authority at the admission stage.",
      ],
      [
        "43. The Code is a beneficial legislation which puts the corporate debtor back on its feet, not a mere recovery legislation for creditors. The Preamble speaks of reorganisation and insolvency resolution in a time-bound manner.",
        "",
        "44. The distinction between financial and operational creditors is based on intelligible differentia. Financial creditors are, from the very beginning, involved with assessing the viability of the corporate debtor. Operational creditors are not.",
        "",
        "45. That differentia has a direct relation to the object sought to be achieved. Committee of creditors composition is not arbitrary.",
        "",
        "46. At the Section 9 stage, the defence open to a corporate debtor is a pre-existing dispute, not a roving enquiry into the debt.",
      ],
      [
        "47. NCLT and NCLAT are not courts of equity in the wide sense. They apply the Code as written, subject to the limited discretion later recognised in other decisions.",
        "",
        "48. The experimental nature of economic legislation invites judicial restraint. The Code is such an experiment, and it has worked.",
        "",
        "52. For these reasons the writ petitions are dismissed. The provisions under challenge do not suffer from manifest arbitrariness.",
        "",
        "Use this authority for the object of the Code and the limited scope of a Section 9 defence at admission.",
      ],
    ],
  },
  {
    filename: "Vidarbha Industries Power Ltd. v. Axis Bank Ltd., (2022) 8 SCC 352.pdf",
    name: "Vidarbha Industries Power Ltd. v. Axis Bank Ltd.",
    cite: "(2022) 8 SCC 352",
    paras: "56 – 64",
    date: "12 Jul 2022",
    pageFrom: 2,
    pageTo: 3,
    holding:
      "The Adjudicating Authority may, in a fit case, exercise limited discretion even where a financial debt and default are established — though the discretion is not at large and must be guided by the facts.",
    pages: [
      [
        "REPORTABLE",
        "IN THE SUPREME COURT OF INDIA",
        "CIVIL APPEAL NO. 4633 OF 2021",
        "",
        "VIDARBHA INDUSTRIES POWER LTD.  …Appellant",
        "versus",
        "AXIS BANK LTD.  …Respondent",
        "",
        "JUDGMENT",
        "",
        "The Court considered whether Section 7 of the Code is mandatory once debt and default are shown, or whether the Adjudicating Authority retains a residuary discretion to keep a petition in abeyance in an appropriate case.",
      ],
      [
        "56. The language of Section 7(5) is may, not shall. Ordinarily, if debt and default are established, the petition is admitted. That is the rule.",
        "",
        "57. There may, however, be a fit case where admission would be counter-productive — for instance where a regulatory receivable, already adjudicated, is shortly to come in.",
        "",
        "58. The discretion is not at large. It is not an invitation to re-write the Code as a recovery statute or to sit in appeal over commercial wisdom.",
        "",
        "59. Subsequent benches have read this holding narrowly. Do not cite Vidarbha as if every corporate debtor may stall a Section 7 petition.",
      ],
      [
        "60. On the facts, the existence of an unpaid tariff order in favour of the appellant was a relevant circumstance. The NCLT had declined to consider it.",
        "",
        "64. The appeal is allowed in part. The Adjudicating Authority will consider the application afresh in light of these observations.",
        "",
        "Flag the paragraphs you will actually open. Be ready for the bench to ask how later cases have confined this discretion.",
      ],
    ],
  },
];

function wrapLine(s: string, width = 72): string[] {
  if (!s) return [""];
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function judgementPdf(pages: string[][]): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  for (let p = 0; p < pages.length; p++) {
    const page = pdf.addPage([595.28, 841.89]);
    let y = 790;
    const raw = pages[p].flatMap((line) => wrapLine(line));
    raw.forEach((line, i) => {
      if (!line) {
        y -= 12;
        return;
      }
      const isPara = /^\d+\./.test(line);
      const isHead = p === 0 && i < 4;
      const f = isHead || isPara ? bold : font;
      const size = isHead ? 12 : isPara ? 11.5 : 11;
      page.drawText(line, { x: 72, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size * 1.55;
    });
    page.drawText(`Sample authority — page ${p + 1} of ${pages.length}. Replace with the certified copy.`, {
      x: 72,
      y: 40,
      size: 8,
      font: italic,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const bytes = await pdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function makeSampleDocs(columns: Column[]): Promise<{ docs: BinderDoc[]; buffers: ArrayBuffer[] }> {
  const docs: BinderDoc[] = [];
  const buffers: ArrayBuffer[] = [];
  for (const c of CASES) {
    const buf = await judgementPdf(c.pages);
    const doc = blankDoc({
      id: newId(),
      filename: c.filename,
      pageCount: c.pages.length,
      flagged: true,
      kind: "authority",
      searchText: c.pages.flat().join(" "),
      holding: c.holding,
      pageFrom: c.pageFrom,
      pageTo: c.pageTo,
      notes: c.name.startsWith("Swiss") ? "Open on the object of the Code if the bench asks why CIRP is not recovery." : "",
    });
    guessFields(doc, columns);
    const caseCol = columns.find((col) => col.type === "case");
    if (caseCol) doc.fields[caseCol.id] = { name: c.name, cite: c.cite };
    const paraCol = columns.find((col) => col.type === "text" && /para/i.test(col.name));
    if (paraCol) doc.fields[paraCol.id] = c.paras;
    const dateCol = columns.find((col) => col.type === "date");
    if (dateCol) doc.fields[dateCol.id] = c.date;
    docs.push(doc);
    buffers.push(buf);
  }
  return { docs, buffers };
}
