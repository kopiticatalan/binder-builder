import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MetroProgress } from "./progress";

export interface AppAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}

export function AppBar({
  actions,
  overflow = [],
  status,
  statusKind,
}: {
  actions: AppAction[];
  overflow?: AppAction[];
  status?: string;
  statusKind?: string;
}) {
  const [more, setMore] = useState(false);
  return (
    <footer className="app-bar fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      {status ? (
        <div className="flex items-center gap-3 px-4 pt-2">
          {statusKind === "busy" ? <MetroProgress /> : null}
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              statusKind === "ok" && "text-ok",
              statusKind === "err" && "text-err",
              statusKind === "busy" && "text-accent",
              (!statusKind || statusKind === "idle") && "text-muted",
            )}
          >
            {status}
          </p>
        </div>
      ) : null}
      {more && overflow.length ? (
        <div className="app-bar-more grid grid-cols-2 gap-px">
          {overflow.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                setMore(false);
                a.onClick();
              }}
              className="flex min-h-12 items-center gap-3 px-4 text-left text-sm text-fg disabled:opacity-35"
            >
              <span className="[&_svg]:size-4">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <nav className="flex items-stretch justify-around">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={a.disabled}
            onClick={a.onClick}
            className={cn(
              "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-fg transition-colors duration-150 disabled:opacity-35",
              a.accent && "bg-accent",
            )}
          >
            <span className="[&_svg]:size-5">{a.icon}</span>
            <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wider">{a.label}</span>
          </button>
        ))}
        {overflow.length ? (
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className="flex min-h-16 w-14 flex-col items-center justify-center gap-1 text-fg"
            aria-label="More"
            aria-expanded={more}
          >
            <span className="flex gap-0.5">
              <i className="size-1.5 bg-fg" />
              <i className="size-1.5 bg-fg" />
              <i className="size-1.5 bg-fg" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">More</span>
          </button>
        ) : null}
      </nav>
    </footer>
  );
}
