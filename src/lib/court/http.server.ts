import https from "node:https";
import { constants } from "node:crypto";
import { Buffer } from "node:buffer";

const SITE = "https://bombayhighcourt.gov.in";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

export const COURT_SITE = SITE;

const agent = new https.Agent({
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
  keepAlive: true,
  maxSockets: 8,
});

export class CookieJar {
  private cookies = new Map<string, string>();

  absorb(setCookie: string | string[] | undefined) {
    const list = !setCookie
      ? []
      : Array.isArray(setCookie)
        ? setCookie
        : [setCookie];
    for (const c of list) {
      const nv = c.split(";")[0];
      const eq = nv.indexOf("=");
      if (eq > 0) this.cookies.set(nv.slice(0, eq).trim(), nv.slice(eq + 1));
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

export type CourtResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  buf: Buffer;
  url: string;
};

export async function courtRequest(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    jar?: CookieJar;
    timeoutMs?: number;
    follow?: boolean;
  } = {},
): Promise<CourtResponse> {
  const follow = opts.follow !== false;
  let current = url;
  let method = opts.method ?? "GET";
  let body = opts.body;
  let hops = 0;
  const jar = opts.jar ?? new CookieJar();

  while (hops < 8) {
    const res = await rawRequest(current, {
      method,
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        ...(opts.headers ?? {}),
        ...(jar.header() ? { Cookie: jar.header() } : {}),
      },
      body,
      timeoutMs: opts.timeoutMs ?? 30000,
    });
    jar.absorb(res.headers["set-cookie"]);
    const loc = header(res.headers, "location");
    if (
      follow &&
      loc &&
      [301, 302, 303, 307, 308].includes(res.status) &&
      hops < 7
    ) {
      current = new URL(loc, current).href;
      if (res.status === 303 || res.status === 302 || res.status === 301) {
        method = "GET";
        body = undefined;
      }
      hops += 1;
      continue;
    }
    return { ...res, url: current };
  }
  throw new Error("Too many redirects from the court site.");
}

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

function rawPathAndSearch(url: string) {
  const noHash = url.split("#")[0] ?? url;
  const scheme = noHash.indexOf("://");
  const fromHost = scheme >= 0 ? noHash.slice(scheme + 3) : noHash;
  const slash = fromHost.indexOf("/");
  return slash >= 0 ? fromHost.slice(slash) : "/";
}

function rawRequest(
  url: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    timeoutMs: number;
  },
): Promise<CourtResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...opts.headers };
    if (opts.body && !headers["Content-Length"]) {
      const len = Buffer.isBuffer(opts.body)
        ? opts.body.length
        : Buffer.byteLength(opts.body);
      headers["Content-Length"] = String(len);
    }
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        // Keep the original path encoding. Court download URLs are signed and
        // `new URL().pathname` re-encodes `=` in the Laravel payload.
        path: rawPathAndSearch(url),
        method: opts.method,
        agent,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            buf: Buffer.concat(chunks),
            url,
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(opts.timeoutMs, () => {
      req.destroy(new Error("The court site timed out."));
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export async function courtGet(path: string, jar?: CookieJar) {
  const url = path.startsWith("http") ? path : SITE + path;
  return courtRequest(url, { jar });
}

export async function courtPostForm(
  path: string,
  fields: Record<string, string>,
  jar: CookieJar,
  extra: Record<string, string> = {},
) {
  const url = path.startsWith("http") ? path : SITE + path;
  const body = new URLSearchParams(fields).toString();
  return courtRequest(url, {
    method: "POST",
    jar,
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      ...extra,
    },
    timeoutMs: 60000,
  });
}

export async function mapPool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
