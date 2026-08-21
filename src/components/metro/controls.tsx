import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted leading-snug">{hint}</span> : null}
    </label>
  );
}

export function MetroInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("metro-input", props.className)} />;
}

export function MetroSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("metro-select", props.className)} />;
}

export function MetroArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("metro-area", props.className)} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "ghost" | "danger";
};

export function MetroButton({ variant = "ghost", className, children, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold uppercase tracking-wider transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-40",
        variant === "accent" && "bg-accent text-accent-fg",
        variant === "ghost" && "bg-chrome text-fg",
        variant === "danger" && "bg-err text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MetroCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-3 text-left"
    >
      <span
        className={cn(
          "grid size-6 place-items-center border-2 border-fg",
          checked && "bg-accent border-accent",
        )}
        aria-hidden
      >
        {checked ? (
          <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-fg" strokeWidth="2">
            <path d="M2 8.5 6 12.5 14 3.5" />
          </svg>
        ) : null}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
