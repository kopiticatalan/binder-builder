let workerReady = false;

async function pdfjs() {
  const mod = await import("pdfjs-dist");
  if (!workerReady) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    workerReady = true;
  }
  return mod;
}

export async function extractFirstPagesText(bytes: ArrayBuffer, pages = 2): Promise<string> {
  return extractSearchText(bytes, pages, 5000);
}

export async function extractSearchText(bytes: ArrayBuffer, pages = 6, maxChars = 12000): Promise<string> {
  const { getDocument } = await pdfjs();
  const task = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await task.promise;
  const max = Math.min(pages, pdf.numPages);
  const chunks: string[] = [];
  let used = 0;
  for (let i = 1; i <= max && used < maxChars; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      chunks.push(text);
      used += text.length;
    }
  }
  return chunks.join("\n\n").slice(0, maxChars);
}

export async function renderThumb(bytes: ArrayBuffer, width = 96): Promise<string | null> {
  try {
    const { getDocument } = await pdfjs();
    const task = getDocument({ data: new Uint8Array(bytes) });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = width / unscaled.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
