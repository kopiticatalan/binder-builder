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
          Extra names to flag on published lists — besides your own matters, which always match. Defaults are Bharucha
          & Partners, Advani & Co., Advani Law LLP. “Advani & Co.” also hits “Advani and Co”. Saves as you type.
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
  if (!watched.length) return "No extra firms — only your matters flag.";
  if (watched.length <= 3) return watched.join(" · ");
  return `${watched.slice(0, 2).join(" · ")} +${watched.length - 2}`;
}

export function WatchListPanel() {
  const watched = useCourt((s) => s.settings.watched);
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 max-w-xl">
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="label-caps">Firms we watch</span>
        <span className="text-xs text-accent">{open ? "Hide" : "Edit"}</span>
      </button>
      <p className="mt-1 text-sm text-muted">{watchingLabel(watched) || "None"}</p>
      {open ? (
        <div className="mt-4 bg-chrome px-4 py-4">
          <WatchListEditor compact />
        </div>
      ) : null}
    </div>
  );
}
