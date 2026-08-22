/** Talk to the local Python (Mac app) or Vite `/api/court` desk. */

export const COURT_NEEDS_APP =
  "Court lookup needs the Mac app (Download for Mac on the start screen). The public web page cannot reach court sites.";

let localApi: boolean | null = null;

function isJsonResponse(r: Response) {
  return (r.headers.get("content-type") || "").includes("json");
}

export async function hasLocalCourtApi() {
  if (localApi != null) return localApi;
  try {
    const r = await fetch("/api/health", { method: "GET" });
    if (!r.ok || !isJsonResponse(r)) {
      localApi = false;
      return false;
    }
    const j = (await r.json()) as { ok?: boolean };
    localApi = Boolean(j && j.ok);
    return localApi;
  } catch {
    localApi = false;
    return false;
  }
}

export async function tryLocal<T>(op: string, data: unknown): Promise<T | null> {
  if (!(await hasLocalCourtApi())) return null;
  const r = await fetch(`/api/court/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
  if (!isJsonResponse(r)) return null;
  return (await r.json()) as T;
}

export function courtFailMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e || "");
  if (
    /failed to fetch|network|load failed|404|not found|unexpected token|is not valid json/i.test(
      msg,
    )
  ) {
    return COURT_NEEDS_APP;
  }
  return msg || COURT_NEEDS_APP;
}
