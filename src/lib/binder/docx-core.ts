import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { parseRuns } from "./text";
import { isCaseValue, type BinderConfig, type BinderDoc, type Column } from "./types";

function runsOf(text: string, base?: { bold?: boolean; italics?: boolean }, fontName = "Times New Roman", sz = 24) {
  const out: TextRun[] = [];
  String(text)
    .split("**")
    .forEach((part, idx) => {
      if (!part) return;
      out.push(
        new TextRun({
          text: part,
          font: fontName,
          size: sz,
          bold: idx % 2 === 1 ? !base?.bold : !!base?.bold,
          italics: !!base?.italics,
        }),
      );
    });
  return out.length ? out : [new TextRun({ text: "", font: fontName, size: sz })];
}

export async function buildIndexDocx(
  config: BinderConfig,
  columns: Column[],
  docs: BinderDoc[],
  ranges: string[],
): Promise<Blob> {
  const fontName = config.fontFamily === "helvetica" ? "Arial" : "Times New Roman";
  const sz = (config.baseSize || 12) * 2;
  const isA4 = config.pageSize === "a4";
  const isLegal = config.pageSize === "legal";
  const pageW = isA4 ? 11906 : isLegal ? 12240 : 12240;
  const pageH = isA4 ? 16838 : isLegal ? 20160 : 15840;
  const gutter = Math.round((config.gutterMm || 0) * 56.7);
  const usable = pageW - 2880 - gutter;
  const fill = (config.headerFill || "#D9D9D9").replace("#", "");
  const R = (text: string, opts?: { bold?: boolean; italics?: boolean }) =>
    new TextRun({ text, font: fontName, size: sz, ...opts });

  const children: (Paragraph | Table)[] = [];

  String(config.causeTitle || "")
    .replace(/\r/g, "")
    .split("\n")
    .forEach((raw) => {
      if (raw.trim() === "") {
        children.push(new Paragraph({ children: [R("")] }));
        return;
      }
      let align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER;
      if (/^L:/.test(raw)) {
        align = AlignmentType.LEFT;
        raw = raw.slice(2);
      }
      if (raw.includes("\t")) {
        const [l, r] = raw.split("\t");
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            tabStops: [{ type: TabStopType.RIGHT, position: usable }],
            children: [...runsOf(l, undefined, fontName, sz), R("\t"), ...runsOf(r, undefined, fontName, sz)],
          }),
        );
        return;
      }
      children.push(new Paragraph({ alignment: align, children: runsOf(raw, undefined, fontName, sz) }));
    });

  if (config.caseNumber.trim()) {
    children.push(new Paragraph({ children: [R(`Case No. ${config.caseNumber.trim()}`)] }));
  }
  if (config.hearingDate.trim()) {
    children.push(new Paragraph({ children: [R(`Date of hearing: ${config.hearingDate.trim()}`)] }));
  }
  if (config.appearingFor.trim()) {
    children.push(new Paragraph({ children: [R(`Appearing for: ${config.appearingFor.trim()}`)] }));
  }

  if (config.docTitle.trim()) {
    const rule = () =>
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" } },
        children: [R("")],
      });
    children.push(rule());
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: runsOf("**" + config.docTitle + "**", undefined, fontName, sz),
      }),
    );
    children.push(rule());
    children.push(new Paragraph({ children: [R("")] }));
  }

  if (config.indexHeading.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [R(config.indexHeading, { bold: true })],
      }),
    );
    children.push(new Paragraph({ children: [R("")] }));
  }

  const totW = columns.reduce((a, c) => a + (+c.weight || 1), 0) || 1;
  const colW = columns.map((c) => Math.round((+c.weight || 1) / totW * usable));

  const cell = (runs: TextRun[], opts: { w: number; fill?: string; align: (typeof AlignmentType)[keyof typeof AlignmentType] }) =>
    new TableCell({
      width: { size: opts.w, type: WidthType.DXA },
      shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [new Paragraph({ alignment: opts.align, children: runs })],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c, i) =>
      cell([R(c.name, { bold: true })], { w: colW[i], fill, align: AlignmentType.CENTER }),
    ),
  });

  const bodyRows = docs.map(
    (doc, di) =>
      new TableRow({
        cantSplit: true,
        children: columns.map((c, i) => {
          let runs: TextRun[];
          let align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER;
          if (c.type === "serial") runs = [R(`${di + 1}.${doc.flagged ? "*" : ""}`)];
          else if (c.type === "pages") runs = [R(ranges[di] || "")];
          else if (c.type === "exhibit") runs = [R(doc.exhibit || "", { bold: true })];
          else if (c.type === "case") {
            const v = doc.fields[c.id];
            const name = isCaseValue(v) ? v.name : "";
            const cite = isCaseValue(v) ? v.cite : "";
            runs = [R(name || "", { bold: true })];
            if (cite) runs.push(R(", "), R(cite, { italics: true }));
            align = AlignmentType.LEFT;
          } else {
            runs = runsOf(typeof doc.fields[c.id] === "string" ? (doc.fields[c.id] as string) : "", undefined, fontName, sz);
            if (c.type === "text") align = AlignmentType.LEFT;
          }
          return cell(runs, { w: colW[i], align });
        }),
      }),
  );

  const border = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  children.push(
    new Table({
      width: { size: usable, type: WidthType.DXA },
      columnWidths: colW,
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
      rows: [headerRow, ...bodyRows],
    }),
  );

  if (config.filedBy.trim()) {
    children.push(new Paragraph({ children: [R("")] }));
    children.push(new Paragraph({ children: [R("Filed by:", { bold: true })] }));
    config.filedBy.split("\n").forEach((line) => {
      children.push(new Paragraph({ children: [R(line)] }));
    });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: fontName, size: sz } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: pageW, height: pageH },
            margin: { top: 1440, bottom: 1440, left: 1440 + gutter, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function buildSimpleTableDocx(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  fontFamily: BinderConfig["fontFamily"];
  pageSize: BinderConfig["pageSize"];
}): Promise<Blob> {
  const fontName = opts.fontFamily === "helvetica" ? "Arial" : "Times New Roman";
  const sz = 24;
  const isA4 = opts.pageSize === "a4";
  const isLegal = opts.pageSize === "legal";
  const pageW = isA4 ? 11906 : isLegal ? 12240 : 12240;
  const pageH = isA4 ? 16838 : isLegal ? 20160 : 15840;
  const usable = pageW - 2880;
  const colN = Math.max(1, opts.headers.length);
  const colW = opts.headers.map((_, i) => {
    if (colN === 1) return usable;
    if (i === 0) return Math.round(usable * 0.1);
    return Math.round((usable * 0.9) / (colN - 1));
  });
  const R = (text: string, extra?: { bold?: boolean; italics?: boolean }) =>
    new TextRun({ text, font: fontName, size: sz, ...extra });
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [R(opts.title, { bold: true })],
    }),
  ];
  if (opts.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [R(opts.subtitle)],
      }),
    );
  }
  children.push(new Paragraph({ children: [R("")] }));

  const cell = (text: string, w: number, header = false) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" } : undefined,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [new Paragraph({ children: [R(text, { bold: header })] })],
    });

  const border = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  children.push(
    new Table({
      width: { size: usable, type: WidthType.DXA },
      columnWidths: colW,
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: opts.headers.map((h, i) => cell(h, colW[i], true)),
        }),
        ...opts.rows.map(
          (row) =>
            new TableRow({
              cantSplit: true,
              children: opts.headers.map((_, i) => cell(row[i] || "", colW[i])),
            }),
        ),
      ],
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: fontName, size: sz } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: pageW, height: pageH },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

