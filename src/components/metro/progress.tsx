export function MetroProgress({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="metro-dots" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {label ? <span className="text-xs text-accent">{label}</span> : null}
    </div>
  );
}
