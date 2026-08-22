import { MetroButton, MetroInput } from "@/components/metro/controls";
import { useCourt } from "@/lib/binder/court-store";
import { useBinder } from "@/lib/binder/store";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { useState } from "react";

export function WatchListEditor({ compact = false }: { compact?: boolean }) {
  const watched = useCourt((s) => s.settings.watched);
  const setSettings = useCourt((s) => s.setSettings);
  const setStatus = useBinder((s) => s.setStatus);
  const [draft, setDraft] = useState("");

  function commit(next: string[]) {
    setSettings({ watched: next });
  }

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (watched.some((w) => w.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    commit([...watched, name]);
    setDraft("");
    setStatus(`Watching ${name}.`, "ok");
  }

  return (
    <div>
      {!compact ? (
        <p className="mb-4 text-sm text-muted leading-relaxed">
          Cause-list scans flag boards where these names appear — Bombay High Court, SAT and NCLT.
          Defaults are the original tracker's three: Bharucha & Partners, Advani & Co.,
          Advani Law LLP. Matching is flexible: “Advani & Co.” also hits “Advani and Co” /
          “Advani & Company”. Changes save as you type.
        </p>
      ) : null}
      <ul className={compact ? "mb-3 space-y-2" : "mb-4 space-y-2"}>
        {watched.map((w, i) => (
          <li key={i} className="flex gap-2">
            <MetroInput
              value={w}
              onChange={(e) => {
                const next = [...watched];
                next[i] = e.target.value;
                commit(next);
              }}
              onBlur={() => commit(watched.map((x) => x.trim()).filter(Boolean))}
              aria-label={`Watched firm ${i + 1}`}
            />
            <MetroButton
              variant="danger"
              className="min-h-11 px-3"
              onClick={() => {
                commit(watched.filter((_, j) => j !== i));
                setStatus("Firm removed from the watch list.", "ok");
              }}
            >
              Remove
            </MetroButton>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[160px] flex-1">
          <MetroInput
            placeholder="Firm name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
        </div>
        <MetroButton variant="accent" onClick={add}>
          Add
        </MetroButton>
        <MetroButton
          onClick={() => {
            commit([...DEFAULT_SETTINGS.watched]);
            setStatus("Watch list restored to Bharucha & Partners, Advani & Co., Advani Law LLP.", "ok");
          }}
        >
          Original three
        </MetroButton>
      </div>
    </div>
  );
}

export function watchingLabel(watched: string[]) {
  if (!watched.length) return "No firms on the watch list — only your own matters will flag.";
  if (watched.length <= 3) return `Watching ${watched.join(" · ")}.`;
  return `Watching ${watched.slice(0, 2).join(" · ")} and ${watched.length - 2} more.`;
}
