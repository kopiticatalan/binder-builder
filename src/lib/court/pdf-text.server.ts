import { inflateSync, inflateRawSync, unzipSync } from "node:zlib";
import { Buffer } from "node:buffer";

function inflate(raw: Buffer): Buffer | null {
  for (const fn of [unzipSync, inflateSync, inflateRawSync]) {
    try {
      const out = fn(raw);
      if (out && out.length) return out;
    } catch {
      /* try next */
    }
  }
  return null;
}

function extractOps(decoded: Buffer): string {
  const s = decoded.toString("latin1");
  const res: string[] = [];
  let i = 0;
  const L = s.length;
  while (i < L) {
    const c = s[i];
    if (c === "(") {
      let j = i + 1;
      let depth = 1;
      const buf: string[] = [];
      while (j < L && depth > 0) {
        const d = s[j];
        if (d === "\\") {
          const n = s[j + 1] ?? "";
          if (n === "n") buf.push("\n");
          else if (n === "r") {
            /* skip */
          } else if (n === "t") buf.push(" ");
          else if (n && "01234567".includes(n)) {
            let o = n;
            let k = j + 2;
            while (k < L && "01234567".includes(s[k]) && o.length < 3) {
              o += s[k];
              k += 1;
            }
            buf.push(String.fromCharCode(parseInt(o, 8) & 0xff));
            j = k;
            continue;
          } else buf.push(n);
          j += 2;
          continue;
        }
        if (d === "(") {
          depth += 1;
          buf.push(d);
          j += 1;
        } else if (d === ")") {
          depth -= 1;
          if (depth > 0) buf.push(d);
          j += 1;
        } else {
          buf.push(d);
          j += 1;
        }
      }
      res.push(buf.join(""));
      i = j;
      continue;
    }
    if (s.startsWith("Td", i) || s.startsWith("TD", i) || s.startsWith("T*", i)) {
      res.push("\n");
      i += 2;
      continue;
    }
    i += 1;
  }
  return res.join("");
}

export function pdfText(data: Buffer): string {
  const out: string[] = [];
  let i = 0;
  while (true) {
    const s = data.indexOf("stream", i);
    if (s < 0) break;
    let j = s + 6;
    if (data[j] === 0x0d && data[j + 1] === 0x0a) j += 2;
    else if (data[j] === 0x0a || data[j] === 0x0d) j += 1;
    const e = data.indexOf("endstream", j);
    if (e < 0) break;
    const raw = data.subarray(j, e);
    i = e + 9;
    const dec = inflate(raw);
    if (!dec) continue;
    if (!dec.includes("Tj") && !dec.includes("TJ")) continue;
    try {
      out.push(extractOps(dec));
    } catch {
      /* skip stream */
    }
  }
  return out.join("").replace(/\x00/g, "");
}

export function excerptText(text: string, max = 3500) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}
