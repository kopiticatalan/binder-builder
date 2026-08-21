import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown, FileText, Folder, Gavel, Play, Plus, Undo2 } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { Pivot } from "@/components/metro/pivot";
import { StatusBar } from "@/components/metro/status-bar";
import { CoverPanel } from "@/components/binder/cover-panel";
import { IndexPanel } from "@/components/binder/index-panel";
import { OutputPanel } from "@/components/binder/output-panel";
import { PapersPanel } from "@/components/binder/papers-panel";
import { StylePanel } from "@/components/binder/style-panel";
import { CoverPreview } from "@/components/binder/cover-preview";
import { runBuild, runWord } from "@/lib/binder/actions";
import { useBinder } from "@/lib/binder/store";

const TABS = [
  { id: "cover", label: "cover" },
  { id: "index", label: "index" },
  { id: "papers", label: "papers" },
  { id: "style", label: "style" },
  { id: "preview", label: "preview" },
  { id: "output", label: "output" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/binder")({
  component: BinderWorkspace,
});

function BinderWorkspace() {
  const navigate = useNavigate();
  const ready = useBinder((s) => s.ready);
  const matter = useBinder((s) => s.active());
  const status = useBinder((s) => s.status);
  const statusKind = useBinder((s) => s.statusKind);
  const setStatus = useBinder((s) => s.setStatus);
  const addPdfFiles = useBinder((s) => s.addPdfFiles);
  const undo = useBinder((s) => s.undo);
  const [tab, setTab] = useState<Tab>("cover");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "Enter") {
        e.preventDefault();
        if (!matter) return;
        setStatus("Building binder…", "busy");
        void runBuild(matter, (m) => setStatus(m, "busy"))
          .then((res) => setStatus(`Done — ${res.total} pages.`, "ok"))
          .catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      if (!meta && !e.altKey && e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
        const map: Record<string, Tab> = { "1": "cover", "2": "index", "3": "papers", "4": "style", "5": "preview", "6": "output" };
        if (map[e.key]) setTab(map[e.key]);
        if (e.key === "h") void navigate({ to: "/hearing" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matter, setStatus, undo, navigate]);

  if (!ready) {
    return (
      <main className="min-h-dvh bg-bg px-4 pt-16 text-muted">
        Loading…
      </main>
    );
  }
  if (!matter) {
    return (
      <main className="min-h-dvh bg-bg px-4 pt-16 text-fg">
        <p>No matter open.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <StatusBar />
      <header className="px-4 pt-6 md:px-10 md:pt-8">
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          className="mb-3 text-sm text-accent"
        >
          ← start
        </button>
        <h1 className="panorama-title truncate">{matter.name.toLowerCase()}</h1>
        <Pivot tabs={[...TABS]} value={tab} onChange={setTab} />
      </header>
      <section className="px-4 pt-6 md:px-10">
        {tab === "cover" && <CoverPanel matter={matter} />}
        {tab === "index" && <IndexPanel matter={matter} />}
        {tab === "papers" && <PapersPanel matter={matter} />}
        {tab === "style" && <StylePanel matter={matter} />}
        {tab === "preview" && (
          <CoverPreview config={matter.config} columns={matter.columns} docs={matter.docs} />
        )}
        {tab === "output" && <OutputPanel matter={matter} />}
      </section>
      <AppBar
        status={status}
        statusKind={statusKind}
        actions={[
          {
            id: "add",
            label: "Add PDFs",
            icon: <Plus />,
            onClick: () => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "application/pdf";
              input.multiple = true;
              input.onchange = () => {
                if (input.files) void addPdfFiles([...input.files]);
              };
              input.click();
            },
          },
          {
            id: "build",
            label: "Build",
            icon: <Play />,
            accent: true,
            disabled: statusKind === "busy",
            onClick: () => {
              setTab("output");
              setStatus("Building binder…", "busy");
              void runBuild(matter, (m) => setStatus(m, "busy"))
                .then((res) =>
                  setStatus(
                    res.volumes && res.volumes.length > 1
                      ? `Done — ${res.volumes.length} volumes.`
                      : `Done — ${res.total} pages.`,
                    "ok",
                  ),
                )
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            },
          },
          {
            id: "hearing",
            label: "Hearing",
            icon: <Gavel />,
            onClick: () => void navigate({ to: "/hearing" }),
          },
          {
            id: "matters",
            label: "Matters",
            icon: <Folder />,
            onClick: () => void navigate({ to: "/matters" }),
          },
        ]}
        overflow={[
          {
            id: "word",
            label: "Cover + index (Word)",
            icon: <FileText />,
            disabled: statusKind === "busy",
            onClick: () => {
              setStatus("Exporting Word…", "busy");
              void runWord(matter, (m) => setStatus(m, "busy"))
                .then(() => setStatus("Word cover + index exported.", "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            },
          },
          {
            id: "starred",
            label: "Build starred only",
            icon: <Play />,
            disabled: statusKind === "busy",
            onClick: () => {
              setStatus("Building convenience volume…", "busy");
              void runBuild(matter, (m) => setStatus(m, "busy"), { starredOnly: true })
                .then((res) => setStatus(`Convenience volume — ${res.total} pages.`, "ok"))
                .catch((e) => setStatus(e instanceof Error ? e.message : String(e), "err"));
            },
          },
          {
            id: "undo",
            label: "Undo",
            icon: <Undo2 />,
            onClick: () => undo(),
          },
          {
            id: "out",
            label: "Output",
            icon: <FileDown />,
            onClick: () => setTab("output"),
          },
        ]}
      />
    </main>
  );
}
