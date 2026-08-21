import JSZip from "jszip";
import { buildIndexDocx, buildSimpleTableDocx } from "./docx-core";
import { buildBinder, buildCover, buildSpine } from "./pdf-core";
import { loadBytes } from "./idb";
import { paperTitle, tableOfAuthorities, TOA_ORDER, docDateValue } from "./toa";
import { parseLooseDate } from "./dates";
import { effectivePages, type BuildResult, type Matter } from "./types";
import { downloadBlob, fileSafe, titleCase } from "@/lib/utils";

export async function docsWithBytes(matter: Matter) {
  const docs = [];
  for (const d of matter.docs) {
    const bytes = await loadBytes(d.id);
    if (!bytes) throw new Error(`Missing file for ${d.filename}. Add it again.`);
    docs.push({ ...d, bytes });
  }
  return docs;
}

export async function runBuild(
  matter: Matter,
  onStatus: (s: string) => void,
  opts?: { starredOnly?: boolean },
): Promise<BuildResult & { blob: Blob; filename: string }> {
  const source = opts?.starredOnly ? { ...matter, docs: matter.docs.filter((d) => d.flagged) } : matter;
  if (!source.docs.length) {
    throw new Error(opts?.starredOnly ? "Star at least one paper first." : "Add at least one PDF first.");
  }
  if (!matter.columns.length) throw new Error("Add at least one index column.");
  const docs = await docsWithBytes(source);
  const res = await buildBinder(source.config, source.columns, docs, onStatus);
  const base = fileSafe(
    titleCase(
      (opts?.starredOnly ? "To be read — " : "") + (matter.config.docTitle.trim() || "Binder"),
    ),
  );
  if (res.volumes && res.volumes.length > 1) {
    const zip = new JSZip();
    res.volumes.forEach((v) => zip.file(`${base} - ${v.filename}`, v.bytes));
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${base} - volumes.zip`);
    return { ...res, blob, filename: `${base} - volumes.zip` };
  }
  const blob = new Blob([res.bytes as BlobPart], { type: "application/pdf" });
  downloadBlob(blob, `${base}.pdf`);
  return { ...res, blob, filename: `${base}.pdf` };
}

export async function runWord(matter: Matter, onStatus: (s: string) => void) {
  if (!matter.columns.length) throw new Error("Add at least one index column.");
  onStatus("Computing page ranges…");
  const docs = matter.docs.length ? await docsWithBytes(matter) : [];
  let coverPages = 1;
  let ranges: string[] = [];
  if (docs.length) {
    for (let iter = 0; iter < 4; iter++) {
      let start = coverPages + 1;
      if (matter.config.numberingMode !== "continuous") start = 1;
      ranges = docs.map((d) => {
        const n = effectivePages(d);
        const r = `${start} - ${start + n - 1}`;
        start += n;
        return r;
      });
      const cover = await buildCover(matter.config, matter.columns, docs, ranges);
      const n = cover.pdf.getPageCount();
      if (n === coverPages) break;
      coverPages = n;
    }
  }
  onStatus("Building Word file…");
  const blob = await buildIndexDocx(matter.config, matter.columns, matter.docs, ranges);
  const title = fileSafe(titleCase(matter.config.docTitle.trim() || "Binder"));
  downloadBlob(blob, `${title} - Cover and Index.docx`);
}

export async function runSpine(matter: Matter) {
  const bytes = await buildSpine(matter.config);
  downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "spine-labels.pdf");
}

export async function runBackup(matter: Matter) {
  const zip = new JSZip();
  zip.file(
    "binder.json",
    JSON.stringify(
      {
        name: matter.name,
        templateId: matter.templateId,
        config: matter.config,
        columns: matter.columns,
        docs: matter.docs.map((d) => ({ ...d, searchText: d.searchText ? d.searchText.slice(0, 4000) : "" })),
        deadlines: matter.deadlines,
        oralOutline: matter.oralOutline,
      },
      null,
      2,
    ),
  );
  for (const d of matter.docs) {
    const buf = await loadBytes(d.id);
    if (buf) zip.file(`papers/${d.filename}`, buf);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, fileSafe(matter.name) + "-backup.zip");
}

export function exportTemplate(matter: Matter) {
  const t = {
    causeTitle: matter.config.causeTitle,
    docTitle: matter.config.docTitle,
    indexHeading: matter.config.indexHeading,
    fontFamily: matter.config.fontFamily,
    baseSize: matter.config.baseSize,
    pageSize: matter.config.pageSize,
    pnSize: matter.config.pageNum.size,
    pnBold: matter.config.pageNum.bold,
    pnPos: matter.config.pageNum.pos,
    headerFill: matter.config.headerFill,
    borders: matter.config.borders,
    numberingMode: matter.config.numberingMode,
    exhibitScheme: matter.config.exhibitScheme,
    columns: matter.columns.map((c) => ({ name: c.name, type: c.type, weight: c.weight })),
  };
  downloadBlob(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }), "binder-template.json");
}

export async function runToa(matter: Matter) {
  const grouped = tableOfAuthorities(matter);
  const rows: string[][] = [];
  for (const bucket of TOA_ORDER) {
    const list = grouped[bucket];
    if (!list.length) continue;
    rows.push([bucket, "", "", ""]);
    list.forEach((r, i) => {
      rows.push([`${i + 1}.`, r.name + (r.flagged ? " *" : ""), r.cite, r.paras]);
    });
  }
  if (rows.length === 0) throw new Error("No authorities with case names yet.");
  const blob = await buildSimpleTableDocx({
    title: "TABLE OF AUTHORITIES",
    subtitle: matter.config.docTitle || matter.name,
    headers: ["", "Authority", "Citation", "Pinpoint"],
    rows,
    fontFamily: matter.config.fontFamily,
    pageSize: matter.config.pageSize,
  });
  downloadBlob(blob, fileSafe(matter.name) + " - Table of Authorities.docx");
}

export async function runChronology(matter: Matter) {
  const dated = matter.docs
    .map((d, i) => {
      const raw = docDateValue(d, matter.columns);
      const parsed = parseLooseDate(raw);
      return { d, i, raw, t: parsed ? parsed.getTime() : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const rows = dated.map((x, n) => [
    String(n + 1),
    x.raw || "—",
    paperTitle(x.d, matter.columns),
    x.d.kind,
    x.d.flagged ? "*" : "",
  ]);
  const blob = await buildSimpleTableDocx({
    title: "CHRONOLOGY",
    subtitle: matter.config.docTitle || matter.name,
    headers: ["Sr", "Date", "Document", "Kind", "Read"],
    rows,
    fontFamily: matter.config.fontFamily,
    pageSize: matter.config.pageSize,
  });
  downloadBlob(blob, fileSafe(matter.name) + " - Chronology.docx");
}

export async function runOutline(matter: Matter) {
  const flagged = matter.docs.filter((d) => d.flagged);
  const lines = [
    matter.config.docTitle || matter.name,
    matter.config.caseNumber,
    matter.config.hearingDate ? `Hearing: ${matter.config.hearingDate}` : "",
    "",
    "ORAL SUBMISSIONS",
    "",
    matter.oralOutline || "(add an outline on Desk)",
    "",
    "AUTHORITIES TO BE OPENED",
    ...flagged.map((d, i) => `${i + 1}. ${paperTitle(d, matter.columns)}${d.notes ? " — " + d.notes : ""}`),
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "");
  const blob = await buildSimpleTableDocx({
    title: "ORAL SUBMISSIONS",
    subtitle: matter.config.docTitle || matter.name,
    headers: ["Note"],
    rows: lines.map((l) => [l]),
    fontFamily: matter.config.fontFamily,
    pageSize: matter.config.pageSize,
  });
  downloadBlob(blob, fileSafe(matter.name) + " - Oral submissions.docx");
}

export function printEstimate(pages: number, copies: number, color: boolean) {
  const rate = color ? 8 : 2;
  const sheets = pages * Math.max(1, copies);
  return {
    sheets,
    rate,
    inr: sheets * rate,
    copies: Math.max(1, copies),
    color,
  };
}
