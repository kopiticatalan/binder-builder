import { cn } from "@/lib/utils";

interface PivotProps<T extends string> {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}

export function Pivot<T extends string>({ tabs, value, onChange }: PivotProps<T>) {
  return (
    <div className="pivot-scroller -mx-1 px-1" role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "pivot-tab font-display shrink-0 px-3 py-2 font-light tracking-wide transition-colors duration-150",
              active ? "text-fg text-[1.85rem] md:text-4xl" : "text-muted text-xl md:text-2xl",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
