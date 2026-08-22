import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Tile } from "@/components/metro/tile";
import { PageShell } from "@/components/metro/shell";
import { MetroCheck } from "@/components/metro/controls";
import { TEMPLATES } from "@/lib/binder/templates";
import { useBinder } from "@/lib/binder/store";
import { useState } from "react";

export const Route = createFileRoute("/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const navigate = useNavigate();
  const applyTemplate = useBinder((s) => s.applyTemplate);
  const newMatter = useBinder((s) => s.newMatter);
  const [keep, setKeep] = useState(true);

  return (
    <PageShell title="templates" backTo="/" backLabel="home">
      <p className="mb-4 max-w-xl text-sm text-muted leading-relaxed">
        Captions and index columns for the usual Indian and common-law hearings — NCLT, SLP, writ, commercial, trial, arbitration, DRT, consumer, criminal appeal.
      </p>
      <div className="mb-6">
        <MetroCheck checked={keep} onChange={setKeep} label="Keep existing PDFs when applying to the open matter" />
      </div>
      <div className="grid max-w-4xl grid-cols-2 gap-2 md:gap-3">
        {TEMPLATES.map((t) => (
          <Tile
            key={t.id}
            color={t.tile}
            wide={t.id === "nclt-compilation"}
            title={t.name}
            subtitle={t.blurb}
            onClick={() => {
              applyTemplate(t.id, keep);
              void navigate({ to: "/binder" });
            }}
          />
        ))}
      </div>
      <p className="mt-8 text-xs text-muted">
        Or{" "}
        <button
          type="button"
          className="text-accent underline-offset-2 hover:underline"
          onClick={() => {
            newMatter("to-be-read");
            void navigate({ to: "/binder" });
          }}
        >
          open a thin “to be read” volume
        </button>
        .
      </p>
    </PageShell>
  );
}
