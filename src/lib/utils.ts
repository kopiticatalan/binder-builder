import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId() {
  return crypto.randomUUID();
}

export function fileSafe(s: string) {
  return (s || "Binder").replace(/[/\\:*?"<>|]/g, "-").slice(0, 120);
}

export function titleCase(s: string) {
  return s === s.toUpperCase()
    ? s
        .split(/\s+/)
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ")
    : s;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

export function roman(n: number, lower = false) {
  if (n <= 0) return "0";
  const pairs: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let x = n;
  for (const [v, s] of pairs) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return lower ? out.toLowerCase() : out;
}

export function letterLabel(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const n = Math.max(1, limit);
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
