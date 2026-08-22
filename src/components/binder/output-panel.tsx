import { useRef, useState, type ReactNode } from "react";
import { Field, MetroButton } from "@/components/metro/controls";
import { checklistScore, filingChecklist } from "@/lib/binder/checklist";
import {
  exportTemplate,
  runBackup,
  runBuild,
  runChronology,
  runOutline,
  runSpine,
  runToa,
  runWord,
} from "@/lib/binder/actions";
import { parseBackupZip, templateFromJson } from "@/lib/binder/io";
import { useBinder } from "@/lib/binder/store";
import { effectivePages, type Matter } from "@/lib/binder/types";
import { CoverPreview } from "./cover-preview";
import { cn } from "@/lib/utils";

function Action({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-line px-4 py-5">
      <p className="font-display text-2xl font-light leading-none">{title}</p>
      <p className="mt-2 mb-4 max-w-xl text-sm text-muted leading-relaxed">{body}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function OutputPanel({ matter }: { matter: Matter }) {
  const setStatus = useBinder((s) => s.setStatus);
  const statusKind = useBinder((s) => s.statusKind);
  const importMatter = useBinder((s) => s.importMatter);
  const patchActive = useBinder((s) => s.patchActive);
  const [builtUrl, setBuiltUrl] = useState<string | null>(null);
  const tplRef = useRef<HTMLInputElement>(null);
  const bakRef = useRef<HTMLInputElement>(null);
  const checks = filingChecklist(matter);
  const score = checklistScore(checks);
  const pages = matter.docs.reduce((a, d) => a + effectivePages(d), 0);
  const busy = statusKind === "busy";
  const starred = matter.docs.filter((d) => d.flagged).length;

  async function build(starredOnly = false) {
    setStatus(starredOnly ? "Building convenience volume…" : "Building binder…", "busy");
    try {
      const res = await runBuild(matter, (m) => setStatus(m, "busy"), { starredOnly });
      if (builtUrl) URL.revokeObjectURL(builtUrl);
      if (res.volumes && res.volumes.length > 1) {
        setBuiltUrl(null);
        setStatus(`Done — ${res.volumes.length} volumes, ${res.total} pages.`, "ok");
      } else {
        setBuiltUrl(URL.createObjectURL(res.blob));
        setStatus(
          `Done — ${res.total} pages (${res.coverPages} cover/index + ${res.total - res.coverPages} papers). Bookmarks in the sidebar.`,
          "ok",
        );
      }
    } catch (e) {
      console.error(e);
      setStatus("Build failed: " + (e instanceof Error ? e.message : String(e)), "err");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-muted leading-relaxed">
          The binder is a PDF: cover, index, then your papers in order, stamped and bookmarked. Everything else on this
          page is optional — Word for the registry, spine labels for the physical file, a thin “to be read” volume for
          the bench.
        </p>

        <Action
          title="PDF binder"
          body="Needs at least one PDF on Papers. Cover and index are paginated first so the page ranges are real. If you set a volume cap on Look, you get a zip of Volume I of N."
        >
          <MetroButton variant="accent" disabled={busy} onClick={() => void build()}>
            Build PDF binder
          </MetroButton>
          <MetroButton disabled={busy || starred === 0} onClick={() => void build(true)}>
            Starred only ({starred})
          </MetroButton>
        </Action>

        <Action
          title="Cover + index in Word"
          body="Same caption and table, as a .docx — useful when the registry wants Word, or you need to tweak a line before filing."
        >
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Exporting Word…", "busy");
              void runWord(matter, (m) => setStatus(m, "busy"))
                .then(() => setStatus("Word cover + index exported.", "ok"))
                .catch((e) => setStatus("Word export failed: " + (e instanceof Error ? e.message : String(e)), "err"));
            }}
          >
            Cover + index (Word)
          </MetroButton>
        </Action>

        <Action
          title="Hearing extras"
          body="Spine labels print three cut-outs on one page. Table of authorities groups Supreme Court, High Courts and the rest. Chronology sorts on the date column. Oral submissions is your speaking note."
        >
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Drawing spine labels…", "busy");
              void runSpine(matter)
                .then(() => setStatus("Spine labels ready — three cut-outs on one page.", "ok"))
                .catch((e) => setStatus("Spine failed: " + (e instanceof Error ? e.message : String(e)), "err"));
            }}
          >
            Spine labels
          </MetroButton>
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Building table of authorities…", "busy");
              void runToa(matter)
                .then(() => setStatus("Table of authorities exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            }}
          >
            Table of authorities
          </MetroButton>
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Building chronology…", "busy");
              void runChronology(matter)
                .then(() => setStatus("Chronology exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            }}
          >
            Chronology
          </MetroButton>
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Exporting speaking note…", "busy");
              void runOutline(matter)
                .then(() => setStatus("Oral submissions exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            }}
          >
            Oral submissions
          </MetroButton>
        </Action>

        <Action
          title="Take this matter elsewhere"
          body="Backup zip is the whole docket plus PDFs. Restore it from Matters. A template is only caption + index columns — not the papers."
        >
          <MetroButton
            disabled={busy}
            onClick={() => {
              setStatus("Packing matter…", "busy");
              void runBackup(matter)
                .then(() => setStatus("Matter backup downloaded.", "ok"))
                .catch((e) => setStatus("Backup failed: " + (e instanceof Error ? e.message : String(e)), "err"));
            }}
          >
            Backup zip
          </MetroButton>
          <MetroButton
            onClick={() => {
              exportTemplate(matter);
              setStatus("Template saved.", "ok");
            }}
          >
            Save template
          </MetroButton>
          <MetroButton onClick={() => tplRef.current?.click()}>Load template</MetroButton>
          <MetroButton onClick={() => bakRef.current?.click()}>Restore backup</MetroButton>
          <input
            ref={tplRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const raw = JSON.parse(await f.text());
                const { config, columns } = templateFromJson(raw);
                patchActive((m) => {
                  m.config = {
                    ...m.config,
                    ...config,
                    caseNumber: m.config.caseNumber,
                    hearingDate: m.config.hearingDate,
                    appearingFor: m.config.appearingFor,
                    filedBy: m.config.filedBy,
                    court: m.config.court || config.court,
                  };
                  m.columns = columns;
                });
                setStatus("Template loaded onto this matter.", "ok");
              } catch {
                setStatus("Not a valid template file.", "err");
              }
            }}
          />
          <input
            ref={bakRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const { matter: m, buffers } = await parseBackupZip(f);
                importMatter(m, buffers);
                setStatus("Backup restored as a new matter.", "ok");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Restore failed.", "err");
              }
            }}
          />
        </Action>

        {builtUrl ? (
          <Field label="Last build">
            <iframe title="Built binder" src={builtUrl} className="h-[480px] w-full bg-paper" />
          </Field>
        ) : null}

        <div>
          <p className="label-caps mb-3">Before you file</p>
          <p className="mb-3 text-sm text-muted">
            {pages} paper pages · {matter.docs.length} files
            {score.blocking ? ` · ${score.blocking} blocking` : ""}
            {score.warnings ? ` · ${score.warnings} warnings` : ""}
          </p>
          <ul className="divide-y divide-line border border-line">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-3 px-3 py-3">
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center text-[10px] font-bold",
                    c.ok && !c.warn && "bg-ok text-fg",
                    c.warn && "bg-tile-steel text-fg",
                    !c.ok && "bg-err text-fg",
                  )}
                >
                  {c.ok && !c.warn ? "OK" : c.warn ? "!" : "X"}
                </span>
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <p className="label-caps mb-3">Cover preview</p>
        <CoverPreview config={matter.config} columns={matter.columns} docs={matter.docs} compact />
      </div>
    </div>
  );
}
