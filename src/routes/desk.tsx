import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/metro/shell";
import { Field, MetroArea, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { Pivot } from "@/components/metro/pivot";
import { grokAssist } from "@/lib/binder/ai";
import { computeLimitation, LIMITATION_PRESETS } from "@/lib/binder/limitation";
import { daysUntil, toIsoDate } from "@/lib/binder/dates";
import { paperTitle } from "@/lib/binder/toa";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desk")({ component: DeskPage });

const TABS = [
  { id: "limit", label: "limitation" },
  { id: "dates", label: "dates" },
  { id: "search", label: "search" },
  { id: "oral", label: "oral" },
  { id: "keys", label: "keys" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function DeskPage() {
  const matter = useBinder((s) => s.active());
  const addDeadline = useBinder((s) => s.addDeadline);
  const updateDeadline = useBinder((s) => s.updateDeadline);
  const removeDeadline = useBinder((s) => s.removeDeadline);
  const setOralOutline = useBinder((s) => s.setOralOutline);
  const setStatus = useBinder((s) => s.setStatus);
  const [tab, setTab] = useState<Tab>("limit");
  const [from, setFrom] = useState(toIsoDate(new Date()));
  const [preset, setPreset] = useState(LIMITATION_PRESETS[0].id);
  const [q, setQ] = useState("");
  const computed = computeLimitation(from, preset);

  const hits = useMemo(() => {
    if (!matter || q.trim().length < 2) return [];
    const s = q.trim().toLowerCase();
    return matter.docs
      .map((d) => {
        const hay = `${d.filename} ${d.bookmark} ${d.notes} ${d.holding} ${d.searchText}`.toLowerCase();
        const idx = hay.indexOf(s);
        if (idx < 0) return null;
        const snippet = (d.searchText || d.holding || d.notes || d.filename).slice(Math.max(0, idx - 40), idx + 120);
        return { d, snippet };
      })
      .filter((x): x is { d: (typeof matter.docs)[number]; snippet: string } => x != null);
  }, [matter, q]);

  async function draftOutline() {
    if (!matter) return;
    setStatus("Drafting oral submissions…", "busy");
    const starred = matter.docs.filter((d) => d.flagged);
    const payload = [
      matter.config.causeTitle,
      matter.config.docTitle,
      "STARRED:",
      ...starred.map((d) => `- ${paperTitle(d, matter.columns)} | ${d.notes} | ${d.holding}`),
      "DRAFT:",
      matter.oralOutline,
    ].join("\n");
    try {
      const res = await grokAssist({ data: { kind: "outline", text: payload } });
      if (!res.ok) {
        setStatus(res.error, "err");
        return;
      }
      if (res.kind === "outline") setOralOutline(res.text);
      setStatus("Outline drafted. Edit before you rely on it.", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Draft failed", "err");
    }
  }

  return (
    <PageShell title="desk" backTo="/" kicker={<Pivot tabs={[...TABS]} value={tab} onChange={setTab} />}>
      {!matter ? <p className="text-muted">Open a matter first.</p> : null}

      {tab === "limit" && matter ? (
        <div className="max-w-xl space-y-5">
          <p className="text-sm leading-relaxed text-muted text-pretty">
            Working dates only — confirm the article and any condonation before you diary it. The due date can be pinned onto this matter.
          </p>
          <Field label="From date">
            <MetroInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Proceeding">
            <MetroSelect value={preset} onChange={(e) => setPreset(e.target.value)}>
              {LIMITATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </MetroSelect>
          </Field>
          {computed ? (
            <div className="bg-tile-cyan px-5 py-6 text-fg">
              <p className="label-caps text-fg/80">Due</p>
              <p className="font-display text-4xl font-light leading-none">{computed.label}</p>
              <p className="mt-2 text-sm text-fg/80">{computed.preset.note}</p>
            </div>
          ) : null}
          <MetroButton
            variant="accent"
            disabled={!computed}
            onClick={() => {
              if (!computed) return;
              addDeadline({ label: computed.preset.label, date: computed.iso, note: computed.preset.note });
              setStatus("Deadline pinned to this matter.", "ok");
            }}
          >
            Pin to this matter
          </MetroButton>
        </div>
      ) : null}

      {tab === "dates" && matter ? (
        <div className="max-w-xl space-y-4">
          <MetroButton onClick={() => addDeadline()}>Add date</MetroButton>
          {(matter.deadlines ?? []).length === 0 ? (
            <p className="text-muted">No dates yet.</p>
          ) : (
            <ul className="space-y-3">
              {(matter.deadlines ?? []).map((d) => {
                const n = daysUntil(d.date);
                return (
                  <li key={d.id} className="bg-chrome p-4 space-y-3">
                    <Field label="Label">
                      <MetroInput value={d.label} onChange={(e) => updateDeadline(d.id, { label: e.target.value })} />
                    </Field>
                    <Field label="Date">
                      <MetroInput
                        type="date"
                        value={d.date}
                        onChange={(e) => updateDeadline(d.id, { date: e.target.value })}
                      />
                    </Field>
                    <p className={cn("text-xs", n != null && n <= 3 ? "text-err" : "text-muted")}>
                      {n == null ? "" : n === 0 ? "Today." : n < 0 ? `${-n} days past.` : `${n} days remaining.`}
                    </p>
                    <MetroButton variant="danger" onClick={() => removeDeadline(d.id)}>
                      Remove
                    </MetroButton>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "search" && matter ? (
        <div className="max-w-2xl space-y-4">
          <Field label="Find in papers" hint="Indexes the first pages of each PDF after you drop it.">
            <MetroInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="moratorium, section 14…" />
          </Field>
          <ul className="space-y-3">
            {hits.map(({ d, snippet }) => (
              <li key={d.id} className="bg-chrome p-4">
                <p className="font-display text-2xl font-light">{paperTitle(d, matter.columns)}</p>
                <p className="mt-1 text-sm text-muted">{snippet}</p>
              </li>
            ))}
          </ul>
          {q.trim().length >= 2 && hits.length === 0 ? <p className="text-muted">Nothing matched.</p> : null}
        </div>
      ) : null}

      {tab === "oral" && matter ? (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted">
            Private speaking note for this matter. Starred papers are sent when you draft with the model.
          </p>
          <MetroArea rows={14} value={matter.oralOutline} onChange={(e) => setOralOutline(e.target.value)} />
          <MetroButton variant="accent" onClick={() => void draftOutline()}>
            Draft from starred
          </MetroButton>
        </div>
      ) : null}

      {tab === "keys" ? (
        <dl className="max-w-xl space-y-4 text-sm">
          {[
            ["Ctrl / Cmd + Enter", "Build the PDF binder"],
            ["Ctrl / Cmd + Z", "Undo last change"],
            ["1 – 6", "Cover, index, papers, style, preview, output"],
            ["H", "Hearing mode (when not typing)"],
            ["← →", "Turn authorities in hearing mode"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="label-caps">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </PageShell>
  );
}
