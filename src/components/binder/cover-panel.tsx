import { useRef } from "react";
import { Field, MetroArea, MetroButton, MetroInput } from "@/components/metro/controls";
import { grokAssist } from "@/lib/binder/ai";
import { useBinder } from "@/lib/binder/store";
import type { Matter } from "@/lib/binder/types";
import { CoverPreview } from "./cover-preview";

export function CoverPanel({ matter }: { matter: Matter }) {
  const patchConfig = useBinder((s) => s.patchConfig);
  const patchDocket = useBinder((s) => s.patchDocket);
  const setCauseTitle = useBinder((s) => s.setCauseTitle);
  const stampCaptionFromDocket = useBinder((s) => s.stampCaptionFromDocket);
  const setStatus = useBinder((s) => s.setStatus);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const cfg = matter.config;

  function wrapSel() {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const sel = value.slice(selectionStart, selectionEnd) || "text";
    const next = value.slice(0, selectionStart) + `**${sel}**` + value.slice(selectionEnd);
    setCauseTitle(next);
  }

  function prefixLine(prefix: string) {
    const el = areaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = cfg.causeTitle.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = cfg.causeTitle.slice(0, lineStart) + prefix + cfg.causeTitle.slice(lineStart);
    setCauseTitle(next);
  }

  function insertTab() {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart, value } = el;
    setCauseTitle(value.slice(0, selectionStart) + "\t" + value.slice(selectionStart));
  }

  async function formatCaption() {
    setStatus("Formatting caption…", "busy");
    try {
      const res = await grokAssist({ data: { kind: "caption", text: cfg.causeTitle } });
      if (!res.ok) {
        setStatus(res.error, "err");
        return;
      }
      if (res.kind === "caption") setCauseTitle(res.text);
      setStatus("Caption formatted.", "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Format failed", "err");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
      <div className="space-y-5">
        <p className="max-w-2xl text-sm text-muted leading-relaxed text-pretty">
          This is the cover that prints. Court, case number and parties also live on the docket — change them in either
          place. A caption template (Captions on start) only fills wording; it does not lock you to NCLT or any other
          forum.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Petitioner / plaintiff">
            <MetroInput
              value={matter.petitioner}
              onChange={(e) => patchDocket({ petitioner: e.target.value })}
            />
          </Field>
          <Field label="Respondent / defendant">
            <MetroInput
              value={matter.respondent}
              onChange={(e) => patchDocket({ respondent: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label="Cause title"
          hint="Each line is centred. Start with L: to left-align. Tab pushes a designation to the right margin. Wrap a phrase in **double asterisks** to bold it."
        >
          <textarea
            ref={areaRef}
            value={cfg.causeTitle}
            onChange={(e) => setCauseTitle(e.target.value)}
            spellCheck={false}
            className="metro-area caption-area"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <MetroButton variant="accent" onClick={() => stampCaptionFromDocket()}>
            Write from parties
          </MetroButton>
          <MetroButton onClick={() => prefixLine("L:")}>L: line</MetroButton>
          <MetroButton onClick={insertTab}>Insert tab</MetroButton>
          <MetroButton onClick={wrapSel}>Bold</MetroButton>
          <MetroButton onClick={formatCaption}>Clean caption</MetroButton>
        </div>
        <Field
          label="Document title"
          hint="The heading under the cause title — compilation, exhibit binder, written submissions…"
        >
          <MetroInput value={cfg.docTitle} onChange={(e) => patchConfig({ docTitle: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Index heading">
            <MetroInput value={cfg.indexHeading} onChange={(e) => patchConfig({ indexHeading: e.target.value })} />
          </Field>
          <Field label="Court / forum">
            <MetroInput value={cfg.court} onChange={(e) => patchConfig({ court: e.target.value })} />
          </Field>
          <Field label="Case number">
            <MetroInput value={cfg.caseNumber} onChange={(e) => patchConfig({ caseNumber: e.target.value })} />
          </Field>
          <Field label="Hearing date">
            <MetroInput
              type="date"
              value={cfg.hearingDate}
              onChange={(e) => patchConfig({ hearingDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Appearing for">
          <MetroInput
            value={cfg.appearingFor}
            onChange={(e) => patchConfig({ appearingFor: e.target.value })}
            placeholder="the Applicant / the Petitioner"
          />
        </Field>
        <Field label="Filed by" hint="Counsel block printed after the index. Optional.">
          <MetroArea
            rows={4}
            value={cfg.filedBy}
            onChange={(e) => patchConfig({ filedBy: e.target.value })}
            placeholder={"[Name]\nAdvocate for the Applicant\n[Chambers]"}
          />
        </Field>
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="label-caps mb-3">Live cover</p>
        <CoverPreview config={cfg} columns={matter.columns} docs={matter.docs} compact />
      </div>
    </div>
  );
}
