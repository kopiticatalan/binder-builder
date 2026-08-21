import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFName,
  PDFHexString,
  PDFDict,
  PDFNumber,
  PDFNull,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { roman } from "@/lib/utils";
import { parseCauseLine, parseRuns, type TextRun } from "./text";
import {
  WATERMARK_TEXT,
  effectivePages,
  pageIndices,
  type BinderConfig,
  type BinderDoc,
  type BuildResult,
  type Column,
  type LinkSlot,
  type VolumeFile,
} from "./types";
import { isCaseValue } from "./types";

export const PAGE_SIZES = {
  letter: [612, 792] as const,
  a4: [595.28, 841.89] as const,
  legal: [612, 1008] as const,
};

export type BuildDoc = BinderDoc & { bytes: ArrayBuffer };

type Fonts = {
  reg: PDFFont;
  bold: PDFFont;
  ital: PDFFont;
  boldItal: PDFFont;
};

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "#D9D9D9");
  const v = parseInt(m ? m[1] : "D9D9D9", 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

async function embedFonts(pdf: PDFDocument, family: BinderConfig["fontFamily"]): Promise<Fonts> {
  const S = StandardFonts;
  if (family === "helvetica") {
    return {
      reg: await pdf.embedFont(S.Helvetica),
      bold: await pdf.embedFont(S.HelveticaBold),
      ital: await pdf.embedFont(S.HelveticaOblique),
      boldItal: await pdf.embedFont(S.HelveticaBoldOblique),
    };
  }
  return {
    reg: await pdf.embedFont(S.TimesRoman),
    bold: await pdf.embedFont(S.TimesRomanBold),
    ital: await pdf.embedFont(S.TimesRomanItalic),
    boldItal: await pdf.embedFont(S.TimesRomanBoldItalic),
  };
}

function pickFont(fonts: Fonts, r: TextRun) {
  if (r.bold && r.ital) return fonts.boldItal;
  if (r.bold) return fonts.bold;
  if (r.ital) return fonts.ital;
  return fonts.reg;
}

function wrapRuns(fonts: Fonts, runs: TextRun[], size: number, maxWidth: number): TextRun[][] {
  const words: TextRun[] = [];
  runs.forEach((r) => {
    String(r.text)
      .split(/(\s+)/)
      .forEach((tok) => {
        if (tok !== "") words.push({ text: tok, bold: r.bold, ital: r.ital });
      });
  });
  const lines: TextRun[][] = [];
  let line: TextRun[] = [];
  let w = 0;
  const width = (t: TextRun) => pickFont(fonts, t).widthOfTextAtSize(t.text, size);
  for (const tok of words) {
    const tw = width(tok);
    if (w + tw > maxWidth && line.length) {
      while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
      lines.push(line);
      line = [];
      w = 0;
      if (/^\s+$/.test(tok.text)) continue;
    }
    if (tw > maxWidth) {
      let chunk = "";
      for (const ch of tok.text) {
        const t2 = { ...tok, text: chunk + ch };
        if (width(t2) > maxWidth && chunk) {
          lines.push([{ ...tok, text: chunk }]);
          chunk = ch;
        } else chunk += ch;
      }
      if (chunk) {
        line.push({ ...tok, text: chunk });
        w += width({ ...tok, text: chunk });
      }
      continue;
    }
    line.push(tok);
    w += tw;
  }
  while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop();
  if (line.length) lines.push(line);
  return lines.length ? lines : [[]];
}

function lineWidth(fonts: Fonts, line: TextRun[], size: number) {
  return line.reduce((a, t) => a + pickFont(fonts, t).widthOfTextAtSize(t.text, size), 0);
}

function drawLineRuns(page: PDFPage, fonts: Fonts, line: TextRun[], size: number, x: number, y: number) {
  let cx = x;
  for (const t of line) {
    const f = pickFont(fonts, t);
    if (t.text) page.drawText(t.text, { x: cx, y, size, font: f });
    cx += f.widthOfTextAtSize(t.text, size);
  }
}

function cellRuns(col: Column, doc: BinderDoc, serial: number, range: string): TextRun[] {
  if (col.type === "serial") {
    const star = doc.flagged ? "*" : "";
    return [{ text: `${serial}.${star}`, bold: false, ital: false }];
  }
  if (col.type === "pages") return [{ text: range, bold: false, ital: false }];
  if (col.type === "exhibit") {
    return [{ text: doc.exhibit || "", bold: true, ital: false }];
  }
  const v = doc.fields[col.id];
  if (col.type === "case") {
    const name = isCaseValue(v) ? v.name : "";
    const cite = isCaseValue(v) ? v.cite : "";
    const runs: TextRun[] = [{ text: name, bold: true, ital: false }];
    if (cite) {
      runs.push({ text: ", ", bold: false, ital: false }, { text: cite, bold: false, ital: true });
    }
    return runs;
  }
  return parseRuns(typeof v === "string" ? v : "", false, false);
}

function margins(config: BinderConfig) {
  const g = (config.gutterMm || 0) * 2.83465;
  return { left: 72 + g, right: 72, top: 72, bottom: 72 };
}

export async function buildCover(
  config: BinderConfig,
  columns: Column[],
  docs: BinderDoc[],
  ranges: string[],
): Promise<{ pdf: PDFDocument; links: LinkSlot[] }> {
  const pdf = await PDFDocument.create();
  const fonts = await embedFonts(pdf, config.fontFamily);
  const [PW, PH] = PAGE_SIZES[config.pageSize] || PAGE_SIZES.letter;
  const m = margins(config);
  const size = config.baseSize || 12;
  const LH = size * 1.45;
  const usable = PW - m.left - m.right;
  let page = pdf.addPage([PW, PH]);
  let y = PH - m.top - size;
  const links: LinkSlot[] = [];

  const newPage = () => {
    page = pdf.addPage([PW, PH]);
    y = PH - m.top - size;
  };
  const need = (h: number) => {
    if (y - h < m.bottom) newPage();
  };

  const lines = String(config.causeTitle || "").replace(/\r/g, "").split("\n");
  for (const raw of lines) {
    const parsed = parseCauseLine(raw);
    if (parsed.blank) {
      y -= LH * 0.6;
      continue;
    }
    if (parsed.right) {
      need(LH);
      drawLineRuns(page, fonts, parsed.left, size, m.left, y);
      const rw = lineWidth(fonts, parsed.right, size);
      drawLineRuns(page, fonts, parsed.right, size, PW - m.right - rw, y);
      y -= LH;
      continue;
    }
    const wrapped = wrapRuns(fonts, parsed.left, size, usable);
    for (const ln of wrapped) {
      need(LH);
      const lw = lineWidth(fonts, ln, size);
      const x = parsed.align === "center" ? m.left + (usable - lw) / 2 : m.left;
      drawLineRuns(page, fonts, ln, size, x, y);
      y -= LH;
    }
  }

  const meta: string[] = [];
  if (config.caseNumber.trim()) meta.push(`Case No. ${config.caseNumber.trim()}`);
  if (config.hearingDate.trim()) meta.push(`Date of hearing: ${config.hearingDate.trim()}`);
  if (config.appearingFor.trim()) meta.push(`Appearing for: ${config.appearingFor.trim()}`);
  if (meta.length) {
    y -= LH * 0.3;
    for (const line of meta) {
      need(LH);
      const runs = parseRuns(line, false);
      const wrapped = wrapRuns(fonts, runs, size, usable);
      for (const ln of wrapped) {
        need(LH);
        drawLineRuns(page, fonts, ln, size, m.left, y);
        y -= LH;
      }
    }
  }

  if (config.docTitle.trim()) {
    y -= LH * 0.5;
    need(LH * 3);
    page.drawLine({
      start: { x: m.left, y: y + LH * 0.9 },
      end: { x: PW - m.right, y: y + LH * 0.9 },
      thickness: 0.7,
    });
    const tRuns = parseRuns(config.docTitle, true);
    const wrapped = wrapRuns(fonts, tRuns, size, usable);
    for (const ln of wrapped) {
      need(LH);
      const lw = lineWidth(fonts, ln, size);
      drawLineRuns(page, fonts, ln, size, m.left + (usable - lw) / 2, y);
      y -= LH;
    }
    page.drawLine({
      start: { x: m.left, y: y + LH * 0.55 },
      end: { x: PW - m.right, y: y + LH * 0.55 },
      thickness: 0.7,
    });
    y -= LH * 0.8;
  }

  if (config.indexHeading.trim()) {
    y -= LH * 0.4;
    need(LH);
    const hRuns: TextRun[] = [{ text: config.indexHeading, bold: true, ital: false }];
    const hw = lineWidth(fonts, hRuns, size);
    drawLineRuns(page, fonts, hRuns, size, m.left + (usable - hw) / 2, y);
    y -= LH * 1.4;
  }

  const totW = columns.reduce((a, c) => a + (+c.weight || 1), 0) || 1;
  const colW = columns.map((c) => ((+c.weight || 1) / totW) * usable);
  const PAD = 5;
  const cellLH = size * 1.25;
  const fill = hexToRgb(config.headerFill);

  const layoutRow = (runsPerCell: TextRun[][]) =>
    runsPerCell.map((runs, i) => wrapRuns(fonts, runs, size, colW[i] - 2 * PAD));
  const rowHeight = (wrapped: TextRun[][][]) =>
    Math.max(...wrapped.map((l) => l.length)) * cellLH + 2 * PAD + 2;

  const drawRow = (wrapped: TextRun[][][], h: number, opts: { header?: boolean; docIndex?: number }) => {
    let x = m.left;
    const pageIndex = pdf.getPageCount() - 1;
    for (let i = 0; i < columns.length; i++) {
      if (opts.header) {
        page.drawRectangle({ x, y: y - h, width: colW[i], height: h, color: fill });
      }
      if (config.borders !== false) {
        page.drawRectangle({
          x,
          y: y - h,
          width: colW[i],
          height: h,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.7,
        });
      }
      const lines2 = wrapped[i];
      let ty = y - PAD - size;
      for (const ln of lines2) {
        const lw = lineWidth(fonts, ln, size);
        const centered = opts.header || (columns[i].type !== "case" && columns[i].type !== "text");
        const tx = centered ? x + (colW[i] - lw) / 2 : x + PAD;
        drawLineRuns(page, fonts, ln, size, Math.max(x + PAD, tx), ty);
        ty -= cellLH;
      }
      if (config.hyperlinkIndex && columns[i].type === "pages" && opts.docIndex != null) {
        links.push({ pageIndex, x, y: y - h, w: colW[i], h, docIndex: opts.docIndex });
      }
      x += colW[i];
    }
    y -= h;
  };

  if (columns.length) {
    const headerCells = columns.map((c) => [{ text: c.name, bold: true, ital: false }]);
    const hWrapped = layoutRow(headerCells);
    const hH = rowHeight(hWrapped);
    const drawHeader = () => drawRow(hWrapped, hH, { header: true });
    if (y - hH < m.bottom) newPage();
    drawHeader();

    docs.forEach((doc, di) => {
      const cells = columns.map((c) => cellRuns(c, doc, di + 1, ranges[di] || ""));
      const wrapped = layoutRow(cells);
      const h = rowHeight(wrapped);
      if (y - h < m.bottom) {
        newPage();
        drawHeader();
      }
      drawRow(wrapped, h, { docIndex: di });
    });
  }

  if (config.filedBy.trim()) {
    y -= LH * 1.2;
    need(LH * 3);
    const label = parseRuns("Filed by:", true);
    drawLineRuns(page, fonts, label, size, m.left, y);
    y -= LH;
    for (const raw of config.filedBy.replace(/\r/g, "").split("\n")) {
      need(LH);
      drawLineRuns(page, fonts, parseRuns(raw), size, m.left, y);
      y -= LH;
    }
  }

  if (config.certificatePage) {
    newPage();
    y = PH - m.top - size * 2;
    const title: TextRun[] = [{ text: "CERTIFICATE", bold: true, ital: false }];
    const tw = lineWidth(fonts, title, size);
    drawLineRuns(page, fonts, title, size, m.left + (usable - tw) / 2, y);
    y -= LH * 2;
    const cert = [
      "Certified that the documents compiled herein are true copies of the originals / certified copies, that the pagination is consecutive, and that the papers are arranged in the order of the index.",
      "",
      config.hearingDate.trim() ? `Date: ${config.hearingDate.trim()}` : "Date: ______________",
      "",
      "Advocate for the party",
    ];
    for (const raw of cert) {
      if (!raw) {
        y -= LH;
        continue;
      }
      const wrapped = wrapRuns(fonts, parseRuns(raw), size, usable);
      for (const ln of wrapped) {
        need(LH);
        drawLineRuns(page, fonts, ln, size, m.left, y);
        y -= LH;
      }
    }
  }

  return { pdf, links };
}

function stampPage(
  page: PDFPage,
  label: string,
  font: PDFFont,
  cfg: BinderConfig["pageNum"],
  color: RGB,
) {
  const mb = page.getMediaBox();
  const s = cfg.size || 20;
  const tw = font.widthOfTextAtSize(label, s);
  const rot = (((page.getRotation().angle % 360) + 360) % 360);
  const pos = cfg.pos || "tr";
  let x: number;
  let y: number;
  const top = mb.y + mb.height - 40;
  const bottom = mb.y + 25;
  const right = mb.x + mb.width - 45;
  const centerX = mb.x + mb.width / 2;
  if (rot === 0) {
    x = pos.endsWith("c") ? centerX - tw / 2 : right - tw;
    y = pos.startsWith("t") ? top : bottom;
    page.drawText(label, { x, y, size: s, font, color });
  } else if (rot === 90) {
    x = pos.startsWith("t") ? mb.x + mb.width - 40 : mb.x + 25 + s;
    y = pos.endsWith("c") ? mb.y + mb.height / 2 - tw / 2 : mb.y + mb.height - 45 - tw;
    page.drawText(label, { x, y, size: s, font, color, rotate: degrees(90) });
  } else if (rot === 180) {
    x = pos.endsWith("c") ? centerX + tw / 2 : mb.x + 45 + tw;
    y = pos.startsWith("t") ? mb.y + 40 : mb.y + mb.height - 25;
    page.drawText(label, { x, y, size: s, font, color, rotate: degrees(180) });
  } else {
    x = pos.startsWith("t") ? mb.x + 40 : mb.x + mb.width - 25 - s;
    y = pos.endsWith("c") ? mb.y + mb.height / 2 + tw / 2 : mb.y + 45 + tw;
    page.drawText(label, { x, y, size: s, font, color, rotate: degrees(270) });
  }
}

function addOutlines(
  pdfDoc: PDFDocument,
  items: { title: string; pageIndex: number }[],
) {
  if (!items.length) return;
  const ctx = pdfDoc.context;
  const outlinesRef = ctx.nextRef();
  const refs = items.map(() => ctx.nextRef());
  items.forEach((it, i) => {
    const pageRef = pdfDoc.getPage(it.pageIndex).ref;
    const d = new Map();
    d.set(PDFName.of("Title"), PDFHexString.fromText(it.title));
    d.set(PDFName.of("Parent"), outlinesRef);
    d.set(PDFName.of("Dest"), ctx.obj([pageRef, PDFName.of("XYZ"), PDFNull, PDFNull, PDFNull]));
    if (i > 0) d.set(PDFName.of("Prev"), refs[i - 1]);
    if (i < items.length - 1) d.set(PDFName.of("Next"), refs[i + 1]);
    ctx.assign(refs[i], PDFDict.fromMapWithContext(d, ctx));
  });
  const od = new Map();
  od.set(PDFName.of("Type"), PDFName.of("Outlines"));
  od.set(PDFName.of("First"), refs[0]);
  od.set(PDFName.of("Last"), refs[refs.length - 1]);
  od.set(PDFName.of("Count"), PDFNumber.of(items.length));
  ctx.assign(outlinesRef, PDFDict.fromMapWithContext(od, ctx));
  pdfDoc.catalog.set(PDFName.of("Outlines"), outlinesRef);
  pdfDoc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

function addLink(page: PDFPage, slot: LinkSlot, destPage: PDFPage) {
  const annot = page.doc.context.register(
    page.doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [slot.x, slot.y, slot.x + slot.w, slot.y + slot.h],
      Border: [0, 0, 0],
      Dest: [destPage.ref, "XYZ", null, null, null],
    }),
  );
  page.node.addAnnot(annot);
}

function watermarkLabel(config: BinderConfig) {
  if (config.watermark === "none") return "";
  return WATERMARK_TEXT[config.watermark];
}

function paintWatermark(page: PDFPage, font: PDFFont, label: string) {
  if (!label) return;
  const { width, height } = page.getSize();
  const size = Math.min(width, height) / 10;
  const tw = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: (width - tw) / 2,
    y: height / 2,
    size,
    font,
    rotate: degrees(45),
    color: rgb(0.45, 0.45, 0.45),
    opacity: 0.14,
  });
}

function paintRunningHeader(page: PDFPage, font: PDFFont, text: string, config: BinderConfig) {
  if (!text || !config.runningHeader) return;
  if (config.pageNum.pos.startsWith("t")) return;
  const { width, height } = page.getSize();
  const m = margins(config);
  const size = 8;
  const clipped = text.length > 70 ? text.slice(0, 67) + "…" : text;
  page.drawText(clipped, {
    x: m.left,
    y: height - 28,
    size,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });
  page.drawLine({
    start: { x: m.left, y: height - 32 },
    end: { x: width - m.right, y: height - 32 },
    thickness: 0.4,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function numberLabel(n: number, config: BinderConfig, coverPages: number) {
  const mode = config.numberingMode;
  if (mode === "romanCover") {
    if (n <= coverPages) return roman(n, true);
    return String(n - coverPages);
  }
  if (mode === "docsOnly") {
    if (n <= coverPages) return "";
    return String(n - coverPages);
  }
  if (config.batesPrefix.trim()) {
    const body = mode === "continuous" ? n : n;
    return `${config.batesPrefix.trim()}-${String(body).padStart(6, "0")}`;
  }
  return String(n);
}

async function makeSeparator(config: BinderConfig, title: string, exhibit: string) {
  const pdf = await PDFDocument.create();
  const fonts = await embedFonts(pdf, config.fontFamily);
  const [PW, PH] = PAGE_SIZES[config.pageSize] || PAGE_SIZES.letter;
  const page = pdf.addPage([PW, PH]);
  const size = 18;
  const m = margins(config);
  let y = PH / 2 + 40;
  if (exhibit) {
    const runs: TextRun[] = [{ text: exhibit, bold: true, ital: false }];
    const lw = lineWidth(fonts, runs, 22);
    drawLineRuns(page, fonts, runs, 22, (PW - lw) / 2, y);
    y -= 36;
  }
  const wrapped = wrapRuns(fonts, parseRuns(title, false), size, PW - m.left - m.right);
  for (const ln of wrapped) {
    const lw = lineWidth(fonts, ln, size);
    drawLineRuns(page, fonts, ln, size, (PW - lw) / 2, y);
    y -= size * 1.4;
  }
  return pdf;
}

function packVolumes(docs: BuildDoc[], maxPages: number, extraPerDoc: number): BuildDoc[][] {
  if (!maxPages || maxPages <= 0) return [docs];
  const reserve = 6;
  const budget = Math.max(8, maxPages - reserve);
  const groups: BuildDoc[][] = [];
  let cur: BuildDoc[] = [];
  let used = 0;
  for (const d of docs) {
    const n = effectivePages(d) + extraPerDoc;
    if (cur.length && used + n > budget) {
      groups.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(d);
    used += n;
  }
  if (cur.length) groups.push(cur);
  return groups.length ? groups : [docs];
}

async function buildOne(
  config: BinderConfig,
  columns: Column[],
  docs: BuildDoc[],
  onStatus?: (s: string) => void,
): Promise<Omit<BuildResult, "volumes">> {
  const say = onStatus || (() => {});
  say("Reading PDFs…");
  const srcDocs = await Promise.all(
    docs.map((d) => PDFDocument.load(d.bytes, { ignoreEncryption: true })),
  );
  srcDocs.forEach((sd, i) => {
    docs[i].pageCount = sd.getPageCount();
  });

  say("Laying out index…");
  let coverPages = 1;
  let ranges: string[] = [];
  let links: LinkSlot[] = [];
  for (let iter = 0; iter < 4; iter++) {
    let start = coverPages + 1;
    if (config.numberingMode === "docsOnly" || config.numberingMode === "romanCover") start = 1;
    ranges = docs.map((d) => {
      const n = effectivePages(d) + (config.separatorSheets ? 1 : 0);
      const r = n <= 1 ? `${start}` : `${start} - ${start + n - 1}`;
      start += n;
      return r;
    });
    const cover = await buildCover(config, columns, docs, ranges);
    const n = cover.pdf.getPageCount();
    links = cover.links;
    if (n === coverPages) break;
    coverPages = n;
  }
  const coverBuilt = await buildCover(config, columns, docs, ranges);
  coverPages = coverBuilt.pdf.getPageCount();
  links = coverBuilt.links;

  say("Merging documents…");
  const out = await PDFDocument.create();
  const coverCopied = await out.copyPages(coverBuilt.pdf, coverBuilt.pdf.getPageIndices());
  coverCopied.forEach((p) => out.addPage(p));
  const starts: number[] = [];
  let cursor = coverPages;
  for (let i = 0; i < srcDocs.length; i++) {
    if (config.separatorSheets) {
      const title =
        docs[i].bookmark || docs[i].filename.replace(/\.pdf$/i, "");
      const sep = await makeSeparator(config, title, docs[i].exhibit);
      const sepPages = await out.copyPages(sep, sep.getPageIndices());
      sepPages.forEach((p) => out.addPage(p));
      starts.push(cursor);
      cursor += 1;
    } else {
      starts.push(cursor);
    }
    const idxs = pageIndices(docs[i]).filter((n) => n >= 0 && n < srcDocs[i].getPageCount());
    const pages = await out.copyPages(srcDocs[i], idxs.length ? idxs : srcDocs[i].getPageIndices());
    pages.forEach((p) => out.addPage(p));
    cursor += idxs.length || docs[i].pageCount;
    say(`Merged ${i + 1}/${srcDocs.length}…`);
  }

  say("Stamping page numbers…");
  const fonts = await embedFonts(out, config.fontFamily);
  const stampFont = config.pageNum.bold === false ? fonts.reg : fonts.bold;
  const wm = watermarkLabel(config);
  const headerText = [config.caseNumber, config.docTitle].filter((s) => s && s.trim()).join("  ·  ");
  out.getPages().forEach((p, i) => {
    const label = numberLabel(i + 1, config, coverPages);
    if (label) stampPage(p, label, stampFont, config.pageNum, rgb(0, 0, 0));
    paintWatermark(p, fonts.bold, wm);
    if (i >= coverPages) paintRunningHeader(p, fonts.reg, headerText, config);
  });

  if (config.hyperlinkIndex) {
    for (const slot of links) {
      const destIdx = starts[slot.docIndex];
      if (destIdx == null || destIdx >= out.getPageCount()) continue;
      try {
        addLink(out.getPage(slot.pageIndex), slot, out.getPage(destIdx));
      } catch {
        /* annotation is best-effort */
      }
    }
  }

  say("Adding bookmarks…");
  const items = [{ title: config.indexHeading || "Index", pageIndex: 0 }];
  docs.forEach((d, i) => items.push({ title: d.bookmark || `Document ${i + 1}`, pageIndex: starts[i] }));
  addOutlines(out, items);

  say("Saving…");
  const bytes = await out.save();
  return { bytes, ranges, coverPages, total: cursor };
}

export async function buildBinder(
  config: BinderConfig,
  columns: Column[],
  docs: BuildDoc[],
  onStatus?: (s: string) => void,
): Promise<BuildResult> {
  const extra = config.separatorSheets ? 1 : 0;
  const groups = packVolumes(docs, config.volumeMaxPages, extra);
  if (groups.length <= 1) {
    return buildOne(config, columns, docs, onStatus);
  }
  const volumes: VolumeFile[] = [];
  const totalVol = groups.length;
  for (let i = 0; i < groups.length; i++) {
    const volWord = `VOLUME ${roman(i + 1)} OF ${roman(totalVol)}`;
    const cfg: BinderConfig = {
      ...config,
      docTitle: config.docTitle.trim() ? `${config.docTitle.trim()}\n${volWord}` : volWord,
    };
    onStatus?.(`Building volume ${i + 1} of ${totalVol}…`);
    const res = await buildOne(cfg, columns, groups[i], onStatus);
    volumes.push({
      name: volWord,
      filename: `Volume-${i + 1}-of-${totalVol}.pdf`,
      bytes: res.bytes,
      pages: res.total,
    });
  }
  return {
    bytes: volumes[0].bytes,
    ranges: [],
    coverPages: 0,
    total: volumes.reduce((a, v) => a + v.pages, 0),
    volumes,
  };
}

export async function buildSpine(config: BinderConfig, volumeLabel = ""): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = await embedFonts(pdf, config.fontFamily);
  const page = pdf.addPage([612, 792]);
  const labels = [0, 1, 2].map((i) => 36 + i * 190);
  for (const x of labels) {
    page.drawRectangle({
      x,
      y: 36,
      width: 170,
      height: 720,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
    });
    const title = config.docTitle.trim() || "BINDER";
    const caseNo = config.caseNumber.trim();
    const court = config.court.trim();
    let y = 700;
    const write = (text: string, size: number, bold = false) => {
      const font = bold ? fonts.bold : fonts.reg;
      const wrapped = wrapRuns(fonts, parseRuns(text, bold), size, 140);
      for (const ln of wrapped) {
        const lw = lineWidth(fonts, ln, size);
        drawLineRuns(page, fonts, ln, size, x + 85 - lw / 2, y);
        y -= size * 1.4;
      }
    };
    write("SPINE", 9, true);
    y -= 12;
    if (court) write(court, 10, true);
    if (caseNo) write(caseNo, 11, true);
    y -= 8;
    write(title, 12, true);
    if (volumeLabel) {
      y -= 10;
      write(volumeLabel, 11, true);
    }
    y -= 16;
    if (config.appearingFor.trim()) write(config.appearingFor, 10);
    y = 70;
    write("Cut along the box · fold to spine", 8);
  }
  return pdf.save();
}
