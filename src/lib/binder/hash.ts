export async function fingerprintPdf(buf: ArrayBuffer, filename: string, pageCount: number): Promise<string> {
  const view = new Uint8Array(buf);
  const headLen = Math.min(32768, view.byteLength);
  const tailLen = Math.min(32768, view.byteLength);
  const meta = new TextEncoder().encode(`${pageCount}|${view.byteLength}|${filename.toLowerCase()}`);
  const packed = new Uint8Array(headLen + tailLen + meta.byteLength);
  packed.set(view.subarray(0, headLen), 0);
  packed.set(view.subarray(view.byteLength - tailLen), headLen);
  packed.set(meta, headLen + tailLen);
  const digest = await crypto.subtle.digest("SHA-256", packed);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
