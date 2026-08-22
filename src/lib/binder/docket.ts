import { daysUntil, parseLooseDate, toIsoDate } from "./dates";
import type { Matter, NextStep } from "./types";
import { downloadBlob, fileSafe } from "@/lib/utils";

export function partyCaption(m: Pick<Matter, "petitioner" | "respondent" | "name">): string {
  const p = m.petitioner.trim();
  const r = m.respondent.trim();
  if (p && r) return `${p} v ${r}`;
  if (p) return p;
  if (r) return r;
  return m.name || "Untitled matter";
}

export function captionFromDocket(m: Matter): string {
  const court = (m.config.court.trim() || "[COURT]").toUpperCase();
  const cn = m.config.caseNumber.trim() || "[CASE NUMBER]";
  const p = m.petitioner.trim() || "[Petitioner]";
  const r = m.respondent.trim() || "[Respondent]";
  return [
    `**BEFORE THE ${court}**`,
    "",
    `**${cn}**`,
    "",
    "L:**IN THE MATTER OF:**",
    `L:${p}\t…Petitioner`,
    "versus",
    `L:${r}\t…Respondent`,
  ].join("\n");
}

export function allOpenTasks(matters: Matter[]): { matter: Matter; step: NextStep }[] {
  const out: { matter: Matter; step: NextStep }[] = [];
  for (const m of matters) {
    for (const step of m.tasks ?? []) {
      if (!step.done) out.push({ matter: m, step });
    }
  }
  return out.sort((a, b) => (a.step.due || "9999").localeCompare(b.step.due || "9999"));
}

export function listingDate(m: Matter): string {
  if (m.config.hearingDate) return m.config.hearingDate.trim();
  if (m.nextListing) {
    const d = parseLooseDate(m.nextListing);
    if (d) return toIsoDate(d);
    return m.nextListing.trim();
  }
  return (m.lastListing || "").trim();
}

/** Diary date for the week — never falls back to last date. */
export function nextDate(m: Matter): string {
  if (m.config.hearingDate.trim()) return m.config.hearingDate.trim();
  if (m.nextListing.trim()) {
    const d = parseLooseDate(m.nextListing);
    if (d) return toIsoDate(d);
  }
  return "";
}

export type BoardRow = {
  id: string;
  name: string;
  when: string;
  days: number;
  court: string;
  caseNumber: string;
  stage: string;
  coram: string;
  openTasks: number;
  papers: number;
};

export function boardRows(matters: Matter[]): BoardRow[] {
  return matters
    .map((m) => {
      const when = listingDate(m);
      const days = daysUntil(when);
      if (days == null) return null;
      return {
        id: m.id,
        name: partyCaption(m),
        when,
        days,
        court: m.config.court,
        caseNumber: m.config.caseNumber,
        stage: m.stage,
        coram: m.lastCoram,
        openTasks: (m.tasks ?? []).filter((t) => !t.done).length,
        papers: m.docs.length,
      };
    })
    .filter((x): x is BoardRow => x != null)
    .sort((a, b) => a.days - b.days);
}

export function dayPhrase(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${-days} days ago`;
  return `in ${days} days`;
}

function escIcs(s: string) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildHearingsIcs(matters: Matter[]): { ics: string; events: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Binder Builder//EN",
    "CALSCALE:GREGORIAN",
  ];
  let n = 0;
  const seen = new Set<string>();
  for (const m of matters) {
    const name = partyCaption(m);
    const caseno = m.config.caseNumber || m.name;
    const candidates: { date: string; label: string }[] = [];
    if (m.config.hearingDate) candidates.push({ date: m.config.hearingDate, label: "Hearing" });
    if (m.nextListing) candidates.push({ date: m.nextListing, label: "Listing" });
    for (const t of m.tasks ?? []) {
      if (!t.done && t.due) candidates.push({ date: t.due, label: t.text || "Task" });
    }
    for (const c of candidates) {
      const d = parseLooseDate(c.date);
      if (!d || d < today) continue;
      const ymd = toIsoDate(d).replace(/-/g, "");
      const key = `${m.id}|${ymd}|${c.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      n += 1;
      lines.push(
        "BEGIN:VEVENT",
        `UID:bb-${m.id.replace(/\W/g, "")}-${ymd}-${n}@binder`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `SUMMARY:${escIcs(`${c.label} — ${name} (${caseno})`)}`,
        `DESCRIPTION:${escIcs([caseno, m.config.court, m.stage, m.lastCoram].filter(Boolean).join(" · "))}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return { ics: lines.join("\r\n") + "\r\n", events: n };
}

export function downloadHearingsIcs(matters: Matter[]) {
  const { ics, events } = buildHearingsIcs(matters);
  if (!events) throw new Error("No upcoming hearings or tasks to export.");
  downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), fileSafe("hearings") + ".ics");
  return events;
}
