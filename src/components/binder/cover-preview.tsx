import { useEffect, useState, type ReactNode } from "react";
import { parseCauseLine } from "@/lib/binder/text";
import { effectivePages, isCaseValue, type BinderConfig, type BinderDoc, type Column } from "@/lib/binder/types";
import { cn } from "@/lib/utils";

function Runs({ text, bold, ital }: { text: string; bold?: boolean; ital?: boolean }) {
  const parts = String(text).split("**");
  return (
    <>
      {parts.map((p, i) =>
        p ? (
          <span
            key={i}
            className={cn((i % 2 === 1 ? !bold : bold) && "font-bold", ital && "italic")}
          >
            {p}
          </span>
        ) : null,
      )}
    </>
  );
}

export function CoverPreview({
  config,
  columns,
  docs,
  compact,
}: {
  config: BinderConfig;
  columns: Column[];
  docs: BinderDoc[];
  compact?: boolean;
}) {
  const [cfg, setCfg] = useState(config);
  useEffect(() => {
    const t = window.setTimeout(() => setCfg(config), 140);
    return () => window.clearTimeout(t);
  }, [config]);
  return <CoverPreviewInner config={cfg} columns={columns} docs={docs} compact={compact} />;
}

function CoverPreviewInner({
  config,
  columns,
  docs,
  compact,
}: {
  config: BinderConfig;
  columns: Column[];
  docs: BinderDoc[];
  compact?: boolean;
}) {
  const coverGuess = Math.max(1, Math.ceil((docs.length + 8) / 18));
  let start = config.numberingMode === "continuous" ? coverGuess + 1 : 1;
  const ranges = docs.map((d) => {
    const n = effectivePages(d);
    const r = n <= 1 ? `${start}` : `${start} – ${start + n - 1}`;
    start += n;
    return r;
  });

  return (
    <div
      className={cn(
        "paper mx-auto w-full origin-top text-ink",
        compact ? "max-w-[420px] p-6 text-[10px] leading-snug" : "max-w-[640px] p-8 text-xs leading-relaxed md:p-10 md:text-sm",
      )}
    >
      <div className="space-y-1">
        {config.causeTitle.replace(/\r/g, "").split("\n").map((raw, i) => {
          const line = parseCauseLine(raw);
          if (line.blank) return <div key={i} className="h-2" />;
          if (line.right) {
            return (
              <div key={i} className="flex justify-between gap-3 text-left">
                <span>
                  {line.left.map((r, j) => (
                    <span key={j} className={cn(r.bold && "font-bold", r.ital && "italic")}>
                      {r.text}
                    </span>
                  ))}
                </span>
                <span>
                  {line.right.map((r, j) => (
                    <span key={j} className={cn(r.bold && "font-bold", r.ital && "italic")}>
                      {r.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          return (
            <p key={i} className={cn(line.align === "center" ? "text-center" : "text-left")}>
              {line.left.map((r, j) => (
                <span key={j} className={cn(r.bold && "font-bold", r.ital && "italic")}>
                  {r.text}
                </span>
              ))}
            </p>
          );
        })}
      </div>

      {(config.caseNumber || config.hearingDate || config.appearingFor) && (
        <div className="mt-3 space-y-0.5 text-left">
          {config.caseNumber ? <p>Case No. {config.caseNumber}</p> : null}
          {config.hearingDate ? <p>Date of hearing: {config.hearingDate}</p> : null}
          {config.appearingFor ? <p>Appearing for: {config.appearingFor}</p> : null}
        </div>
      )}

      {config.docTitle.trim() ? (
        <div className="my-4">
          <div className="border-t border-ink" />
          <p className="py-1.5 text-center font-bold">
            <Runs text={config.docTitle} bold />
          </p>
          <div className="border-t border-ink" />
        </div>
      ) : null}

      {config.indexHeading.trim() ? (
        <p className="mb-3 text-center font-bold">{config.indexHeading}</p>
      ) : null}

      {columns.length ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="border border-ink px-1 py-1 text-center font-bold"
                  style={{ width: `${c.weight}%`, background: config.headerFill || "#D9D9D9" }}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td className="border border-ink px-1 py-3 text-center italic" colSpan={columns.length}>
                  Documents appear here
                </td>
              </tr>
            ) : (
              docs.map((d, i) => (
                <tr key={d.id}>
                  {columns.map((c) => {
                    let inner: ReactNode = "";
                    let left = false;
                    if (c.type === "serial") inner = `${i + 1}.${d.flagged ? "*" : ""}`;
                    else if (c.type === "pages") inner = ranges[i];
                    else if (c.type === "exhibit") inner = <strong>{d.exhibit}</strong>;
                    else if (c.type === "case") {
                      const v = d.fields[c.id];
                      left = true;
                      inner = isCaseValue(v) ? (
                        <>
                          <strong>{v.name}</strong>
                          {v.cite ? (
                            <>
                              , <em>{v.cite}</em>
                            </>
                          ) : null}
                        </>
                      ) : null;
                    } else {
                      left = c.type === "text";
                      inner = <Runs text={typeof d.fields[c.id] === "string" ? (d.fields[c.id] as string) : ""} />;
                    }
                    return (
                      <td
                        key={c.id}
                        className={cn("border border-ink px-1 py-1 align-top", left ? "text-left" : "text-center")}
                      >
                        {inner}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {config.filedBy.trim() ? (
        <div className="mt-6 whitespace-pre-wrap text-left">
          <p className="font-bold">Filed by:</p>
          <p>{config.filedBy}</p>
        </div>
      ) : null}
    </div>
  );
}
