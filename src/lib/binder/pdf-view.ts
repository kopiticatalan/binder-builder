import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadBytes } from "./idb";
import { getPdfjs } from "./pdf-text";

const docs = new Map<string, Promise<PDFDocumentProxy>>();
const inflight = new WeakMap<HTMLCanvasElement, RenderTask>();

export function evictPdf(id: string) {
  const pending = docs.get(id);
  docs.delete(id);
  if (pending) {
    void pending
      .then((d) => {
        const destroy = (d as { destroy?: () => Promise<void> }).destroy;
        return destroy?.();
      })
      .catch(() => {});
  }
}

export async function getPdf(id: string): Promise<PDFDocumentProxy> {
  let pending = docs.get(id);
  if (!pending) {
    pending = (async () => {
      const buf = await loadBytes(id);
      if (!buf) throw new Error("PDF is not on this device. Add the file again.");
      const { getDocument } = await getPdfjs();
      const data = new Uint8Array(buf.slice(0));
      return getDocument({ data, disableAutoFetch: true, disableStream: true }).promise;
    })();
    docs.set(id, pending);
    pending.catch(() => {
      docs.delete(id);
    });
  }
  return pending;
}

export async function renderPdfPage(
  id: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<{ numPages: number; width: number; height: number }> {
  const prev = inflight.get(canvas);
  try {
    prev?.cancel();
  } catch {
    /* already done */
  }
  const pdf = await getPdf(id);
  const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages));
  const unscaled = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const width = Math.max(240, cssWidth);
  const scale = (width / unscaled.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the page.");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#f3efe4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const task = page.render({ canvasContext: ctx, viewport, canvas });
  inflight.set(canvas, task);
  try {
    await task.promise;
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (name === "RenderingCancelledException") {
      return { numPages: pdf.numPages, width: canvas.width, height: canvas.height };
    }
    throw err;
  } finally {
    if (inflight.get(canvas) === task) inflight.delete(canvas);
  }
  return { numPages: pdf.numPages, width: canvas.width, height: canvas.height };
}
