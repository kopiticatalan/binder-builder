import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown, FileText, Folder, Gavel, ListOrdered, Play, Plus, Undo2 } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { Pivot } from "@/components/metro/pivot";
import { StatusBar } from "@/components/metro/status-bar";
import { MetroButton } from "@/components/metro/controls";
import { CoverPanel } from "@/components/binder/cover-panel";
import { IndexPanel } from "@/components/binder/index-panel";
import { OutputPanel } from "@/components/binder/output-panel";
import { PapersPanel } from "@/components/binder/papers-panel";
import { StylePanel } from "@/components/binder/style-panel";
import { runBuild, runWord } from "@/lib/binder/actions";
import { partyCaption } from "@/lib/binder/docket";
import { useBinder } from "@/lib/binder/store";

const TABS = [
  { id: "caption", label: "caption" },
  { id: "papers", label: "papers" },
  { id: "look", label: "look" },
  { id: "build", label: "build" },
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
  const newMatter = useBinder((s) => s.newMatter);
  const matters = useBinder((s) => s.matters);
  const setActive = useBinder((s) => s.setActive);
  const stampCaptionFromDocket = useBinder((s) => s.stampCaptionFromDocket);
  const [tab, setTab] = useState<Tab>("caption");

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
        const map: Record<string, Tab> = { "1": "caption", "2": "papers", "3": "look", "4": "build" };
        if (map[e.key]) setTab(map[e.key]);
        if (e.key === "h") void navigate({ to: "/hearing" });
        if (e.key === "d") void navigate({ to: "/docket" });
        if (e.key === "t") void navigate({ to: "/toa" });
        if (e.key === "c") void navigate({ to: "/chrono" });
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
        <p className="mb-2 font-display text-5xl font-light">binder</p>
        <p className="mb-8 max-w-xl text-sm text-muted leading-relaxed">
          A compilation for a hearing. Use a matter’s title, or start a loose one and type the caption yourself.
        </p>
        <div className="mb-8 flex flex-wrap gap-2">
          <MetroButton
            variant="accent"
            onClick={() => {
              newMatter();
              void navigate({ to: "/binder" });
            }}
          >
            New compilation
          </MetroButton>
          <MetroButton onClick={() => void navigate({ to: "/matters" })}>Pick a matter</MetroButton>
        </div>
        {matters.length ? (
          <ul className="max-w-xl divide-y divide-line border border-line">
            {matters.slice(0, 12).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full px-4 py-4 text-left"
                  onClick={() => {
                    setActive(m.id);
                    stampCaptionFromDocket();
                    void navigate({ to: "/binder" });
                  }}
                >
                  <span className="block font-display text-2xl font-light leading-none">{partyCaption(m)}</span>
                  <span className="mt-1 block text-xs text-muted">{m.config.caseNumber || m.config.court || "Open"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <StatusBar />
      <header className="px-4 pt-6 md:px-10 md:pt-8">
        <button
          type="button"
          onClick={() => void navigate({ to: "/docket" })}
          className="mb-3 text-sm text-accent"
        >
          ← matter
        </button>
        <h1 className="panorama-title truncate">{partyCaption(matter).toLowerCase()}</h1>
        <p className="mb-4 max-w-2xl text-sm text-muted leading-relaxed">
          Caption from this matter, or type it. Then drop PDFs, set the look, build.
        </p>
        <Pivot tabs={[...TABS]} value={tab} onChange={setTab} />
      </header>
      <section className="px-4 pt-6 md:px-10">
        {tab === "caption" && <CoverPanel matter={matter} />}
        {tab === "papers" && (
          <div className="space-y-10">
            <PapersPanel matter={matter} />
            <div>
              <p className="label-caps mb-3">Index columns</p>
              <p className="mb-4 max-w-2xl text-sm text-muted leading-relaxed">
                What prints on the contents page. Serial and page range fill themselves. Case name + citation is for
                authorities. Widths are relative (7 / 59 / 22 / 12).
              </p>
              <IndexPanel matter={matter} />
            </div>
          </div>
        )}
        {tab === "look" && <StylePanel matter={matter} />}
        {tab === "build" && <OutputPanel matter={matter} />}
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
              setTab("build");
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
            label: "Build tab",
            icon: <FileDown />,
            onClick: () => setTab("build"),
          },
          {
            id: "toa",
            label: "Authorities",
            icon: <ListOrdered />,
            onClick: () => void navigate({ to: "/toa" }),
          },
          {
            id: "chrono",
            label: "Chronology",
            icon: <FileText />,
            onClick: () => void navigate({ to: "/chrono" }),
          },
        ]}
      />
    </main>
  );
}
