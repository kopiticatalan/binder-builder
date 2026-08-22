import { useEffect, useRef, useState } from "react";
import { renderPdfPage } from "@/lib/binder/pdf-view";
import { cn } from "@/lib/utils";

export function PdfPage({
  docId,
  page,
  className,
  onPages,
}: {
  docId: string;
  page: number;
  className?: string;
  onPages?: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const draw = (cssWidth: number) => {
      setBusy(true);
      setErr(null);
      void renderPdfPage(docId, page, canvas, cssWidth)
        .then((meta) => {
          if (!live) return;
          onPages?.(meta.numPages);
          setBusy(false);
        })
        .catch((e) => {
          if (!live) return;
          setBusy(false);
          setErr(e instanceof Error ? e.message : "Could not draw this page.");
        });
    };

    const kick = () => {
      const w = Math.max(280, Math.round(wrap.clientWidth / 8) * 8);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => draw(w), 80);
    };

    kick();
    const ro = new ResizeObserver(kick);
    ro.observe(wrap);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, [docId, page, onPages]);

  return (
    <div ref={wrapRef} className={cn("pdf-stage", className)}>
      {busy ? (
        <p className="absolute left-4 top-4 z-10 text-xs uppercase tracking-wider text-muted">Drawing page…</p>
      ) : null}
      {err ? <p className="absolute inset-x-4 top-12 z-10 max-w-md text-sm text-err">{err}</p> : null}
      <canvas ref={canvasRef} className={cn("block max-w-full", err && "opacity-20")} />
    </div>
  );
}
