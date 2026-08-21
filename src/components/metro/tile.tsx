import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TILE_BG = {
  cyan: "bg-tile-cyan",
  cobalt: "bg-tile-cobalt",
  teal: "bg-tile-teal",
  emerald: "bg-tile-emerald",
  crimson: "bg-tile-crimson",
  steel: "bg-tile-steel",
} as const;

export type TileColor = keyof typeof TILE_BG;

interface TileProps {
  color: TileColor;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  wide?: boolean;
  large?: boolean;
  to?: string;
  onClick?: () => void;
  live?: string;
  cycle?: string[];
  className?: string;
}

export function Tile({
  color,
  title,
  subtitle,
  icon,
  wide,
  large,
  to,
  onClick,
  live,
  cycle,
  className,
}: TileProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!cycle || cycle.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % cycle.length), 4200);
    return () => window.clearInterval(id);
  }, [cycle]);
  const liveText = cycle?.length ? cycle[i] : live;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-2xl font-light leading-none tracking-tight md:text-3xl">{title}</span>
        {icon ? <span className="text-fg/90">{icon}</span> : null}
      </div>
      <div>
        {liveText ? (
          <p key={liveText} className="live-flip text-sm font-medium leading-snug">
            {liveText}
          </p>
        ) : null}
        {subtitle ? <p className="mt-1 text-sm text-fg/80 leading-snug">{subtitle}</p> : null}
      </div>
    </>
  );

  const cls = cn(
    "tile tile-enter",
    wide && "tile-wide col-span-2",
    large && "tile-lg col-span-2",
    TILE_BG[color],
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

export function ClockTile({ color = "cyan" }: { color?: TileColor }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className={cn("tile tile-enter tile-wide col-span-2", TILE_BG[color])}>
      <p className="font-display text-5xl font-light leading-none tracking-tight tabular-nums md:text-6xl">
        {time}
      </p>
      <p className="text-sm text-fg/85">{date}</p>
    </div>
  );
}
