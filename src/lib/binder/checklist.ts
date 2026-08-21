import { daysUntil } from "./dates";
import { effectivePages } from "./types";
import type { Matter } from "./types";

export interface CheckItem {
  id: string;
  ok: boolean;
  warn: boolean;
  label: string;
  detail: string;
}

const PLACEHOLDER = /\[[^\]]*(?:_|BENCH|CITY|STATE|___|Name of|DISTRICT|RULES|DESIGNATION|CAPTION)[^\]]*\]/;

export function filingChecklist(matter: Matter): CheckItem[] {
  const { config, columns, docs } = matter;
  const items: CheckItem[] = [];
  const pages = docs.reduce((a, d) => a + effectivePages(d), 0);

  items.push({
    id: "caption",
    ok: !!config.causeTitle.trim() && !PLACEHOLDER.test(config.causeTitle),
    warn: PLACEHOLDER.test(config.causeTitle),
    label: "Cause title is finished",
    detail: PLACEHOLDER.test(config.causeTitle)
      ? "Bracketed placeholders remain in the caption."
      : config.causeTitle.trim()
        ? "Caption is filled."
        : "Paste or type the court caption.",
  });

  items.push({
    id: "title",
    ok: !!config.docTitle.trim(),
    warn: false,
    label: "Document title set",
    detail: config.docTitle.trim() || "e.g. Compilation of judgements.",
  });

  items.push({
    id: "docs",
    ok: docs.length > 0,
    warn: false,
    label: "At least one paper",
    detail: docs.length ? `${docs.length} PDF${docs.length === 1 ? "" : "s"} · ${pages} pages` : "Drop PDFs on Papers.",
  });

  const caseCol = columns.find((c) => c.type === "case");
  if (caseCol && docs.length) {
    const missing = docs.filter((d) => {
      const v = d.fields[caseCol.id];
      return !v || typeof v !== "object" || !v.name.trim();
    }).length;
    items.push({
      id: "cites",
      ok: missing === 0,
      warn: missing > 0,
      label: "Every authority has a case name",
      detail: missing ? `${missing} still blank — the index will print empty rows.` : "All case names filled.",
    });
  }

  const names = docs.map((d) => d.filename.toLowerCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  items.push({
    id: "dupes",
    ok: dupes.length === 0,
    warn: dupes.length > 0,
    label: "No duplicate filenames",
    detail: dupes.length ? `Repeated: ${[...new Set(dupes)].join(", ")}` : "Filenames are unique.",
  });

  const hashes = docs.map((d) => d.hash).filter(Boolean);
  const hashDupes = hashes.filter((h, i) => hashes.indexOf(h) !== i);
  if (docs.length) {
    items.push({
      id: "hash",
      ok: hashDupes.length === 0,
      warn: hashDupes.length > 0,
      label: "No duplicate PDF fingerprints",
      detail: hashDupes.length ? "Two papers look like the same file. Drop one before you print." : "Fingerprints are unique.",
    });
  }

  const flagged = docs.filter((d) => d.flagged).length;
  items.push({
    id: "read",
    ok: true,
    warn: docs.length > 8 && flagged === 0,
    label: "Authorities marked to be read",
    detail:
      flagged > 0
        ? `${flagged} starred — they print with an asterisk in the serial column.`
        : docs.length > 8
          ? "Long compilation with nothing starred. Mark the cases you will actually open."
          : "Star the authorities you will read.",
  });

  if (config.volumeMaxPages > 0) {
    const over = pages + 4 > config.volumeMaxPages && docs.length > 0;
    items.push({
      id: "vol",
      ok: true,
      warn: over,
      label: `Volume cap ${config.volumeMaxPages} pages`,
      detail: over
        ? `About ${pages + 4} pages with cover — the build will split into volumes.`
        : "Under the cap, or a single volume will issue.",
    });
  }

  items.push({
    id: "hearing",
    ok: true,
    warn: !config.hearingDate.trim(),
    label: "Hearing date on the cover",
    detail: config.hearingDate.trim() || "Optional, but clerks look for it.",
  });

  const soon = (matter.deadlines ?? []).filter((d) => {
    const n = daysUntil(d.date);
    return n != null && n <= 3;
  });
  items.push({
    id: "deadlines",
    ok: true,
    warn: soon.length > 0,
    label: "Limitation / listings",
    detail: soon.length
      ? `${soon.length} deadline${soon.length === 1 ? "" : "s"} within 3 days.`
      : (matter.deadlines ?? []).length
        ? `${matter.deadlines.length} deadline${matter.deadlines.length === 1 ? "" : "s"} on the desk.`
        : "Add limitation and listing dates on Desk.",
  });

  items.push({
    id: "counsel",
    ok: true,
    warn: !config.filedBy.trim(),
    label: "Filed-by block",
    detail: config.filedBy.trim() ? "Counsel block will print after the index." : "Add chambers details if the court expects them.",
  });

  items.push({
    id: "index",
    ok: columns.length > 0,
    warn: false,
    label: "Index columns defined",
    detail: columns.length ? columns.map((c) => c.name).join(" · ") : "Add at least one column.",
  });

  return items;
}

export function checklistScore(items: CheckItem[]) {
  const must = items.filter((i) => !i.ok && !i.warn);
  const warn = items.filter((i) => i.warn);
  return { blocking: must.length, warnings: warn.length };
}
