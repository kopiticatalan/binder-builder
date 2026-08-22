import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { StatusBar } from "./status-bar";

export function PageShell({
  title,
  backTo,
  backLabel = "home",
  children,
  className,
  kicker,
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
  kicker?: ReactNode;
}) {
  return (
    <div className={cn("min-h-dvh bg-bg text-fg pb-24", className)}>
      <StatusBar />
      <header className="px-4 pt-6 md:px-10 md:pt-8">
        {backTo ? (
          <Link to={backTo} className="mb-3 inline-block text-sm text-accent hover:text-fg">
            ← {backLabel}
          </Link>
        ) : null}
        <h1 className="panorama-title">{title}</h1>
        {kicker}
      </header>
      <div className="px-4 pb-8 md:px-10">{children}</div>
    </div>
  );
}
