import { PDFDocument } from "pdf-lib";
import { fetchCase, fetchOrderPdfs } from "@/lib/court/client";
import { arrayBufferToBase64, deskFs, savePdfToFolder } from "@/lib/court/fs";
import { autoBookmark } from "./guess";
import { saveBytes } from "./idb";
import { matterFromLookup, lookupParamsOf } from "./court-map";
import { filenameForOrder, resolvedOrderFolder } from "./order-files";
import { useBinder } from "./store";
import { useCourt } from "./court-store";
import { markCommonOrders } from "./connected";
import { blankDoc } from "./types";
import type { Matter } from "./types";
import { canFetchCourt, newId } from "@/lib/utils";

function b64ToBuf(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function writeOrderToDisk(
  matter: Matter,
  file: { key: string; filename: string; base64: string },
  overwrite = false,
) {
  const desk = await deskFs();
  if (!desk.fs) return "";
  const settings = useCourt.getState().settings;
  const folder = resolvedOrderFolder(matter, settings, desk.defaultRoot);
  const order = matter.orders.find((o) => o.key === file.key);
  const filename = order ? filenameForOrder(matter, order, settings) : file.filename;
  const out = await savePdfToFolder(folder, filename, file.base64, { overwrite });
  if (!out?.ok) return "";
  return out.path || "";
}

async function ingestOrderFile(
  matter: Matter,
  file: { key: string; filename: string; base64: string; excerpt?: string },
  overwrite = false,
) {
  const stored = b64ToBuf(file.base64);
  let pageCount = 1;
  try {
    const pd = await PDFDocument.load(stored.slice(0), { ignoreEncryption: true });
    pageCount = pd.getPageCount();
  } catch {
    /* still keep the bytes */
  }
  const existing = matter.orders.find((o) => o.key === file.key);
  const docId = existing?.docId || newId();
  const already = matter.docs.some((d) => d.id === docId);
  const diskPath = await writeOrderToDisk(matter, file, overwrite);
  const settings = useCourt.getState().settings;
  const named = existing ? filenameForOrder(matter, existing, settings) : file.filename;
  const doc = blankDoc({
    id: docId,
    filename: named || file.filename,
    pageCount,
    kind: "order",
    notes: file.excerpt || existing?.excerpt || "",
    searchText: file.excerpt || "",
  });
  if (doc.autoBk) doc.bookmark = autoBookmark(doc, matter.columns);
  await saveBytes(doc.id, stored);
  useBinder.getState().patchMatter(
    matter.id,
    (m) => {
      m.orders = m.orders.map((o) =>
        o.key === file.key
          ? {
              ...o,
              downloaded: true,
              excerpt: file.excerpt || o.excerpt,
              docId: doc.id,
              diskPath: diskPath || o.diskPath,
            }
          : o,
      );
      if (!already && !m.docs.some((d) => d.id === doc.id)) {
        m.docs = [...m.docs, doc];
      } else {
        m.docs = m.docs.map((d) => (d.id === doc.id ? { ...d, ...doc } : d));
      }
    },
    { undo: false },
  );
}

export async function saveOrderBytesToFolder(
  matter: Matter,
  order: { key?: string; date: string; title: string; doc?: string; srl?: string },
  buf: ArrayBuffer,
) {
  const desk = await deskFs();
  if (!desk.fs) return { ok: false as const, error: "no-fs" as const };
  const settings = useCourt.getState().settings;
  const folder = resolvedOrderFolder(matter, settings, desk.defaultRoot);
  const filename = filenameForOrder(matter, order as Matter["orders"][number], settings);
  const out = await savePdfToFolder(folder, filename, arrayBufferToBase64(buf));
  if (!out?.ok) return { ok: false as const, error: out?.error || "Could not write that PDF." };
  if (order.key) {
    useBinder.getState().patchMatter(
      matter.id,
      (m) => {
        m.orders = m.orders.map((o) =>
          o.key === order.key ? { ...o, diskPath: out.path || o.diskPath } : o,
        );
      },
      { undo: false },
    );
  }
  return { ok: true as const, path: out.path || folder, existed: out.existed };
}

export async function pullOrders(matter: Matter, opts?: { keys?: string[]; replace?: boolean }) {
  const replace = Boolean(opts?.replace);
  const want =
    opts?.keys ??
    matter.orders.filter((o) => o.key && (replace || !o.downloaded)).map((o) => o.key!);
  if (!want.length) {
    const desk = await deskFs();
    const settings = useCourt.getState().settings;
    return {
      added: 0,
      folder: desk.fs ? resolvedOrderFolder(matter, settings, desk.defaultRoot) : "",
      replaced: replace,
    };
  }
  let added = 0;
  const chunk = 5;
  let current = useBinder.getState().matters.find((m) => m.id === matter.id) ?? matter;
  for (let i = 0; i < want.length; i += chunk) {
    const slice = want.slice(i, i + chunk);
    const res = await fetchOrderPdfs({
      data: {
        forum: current.forum === "sat" ? "sat" : current.forum === "nclt" ? "nclt" : "bhc",
        bench: current.bench,
        side: current.side || "2",
        stampreg: current.stampreg || "R",
        case_type: current.caseType,
        case_no: current.caseNo,
        year: current.year,
        keys: slice,
        petitioner: current.petitioner,
        respondent: current.respondent,
      },
    });
    if (!res.ok) {
      useBinder.getState().setStatus(res.error, "err");
      break;
    }
    for (const f of res.files) {
      current = useBinder.getState().matters.find((m) => m.id === matter.id) ?? current;
      await ingestOrderFile(current, f, replace);
      added += 1;
    }
  }
  current = useBinder.getState().matters.find((m) => m.id === matter.id) ?? current;
  const desk = await deskFs();
  const settings = useCourt.getState().settings;
  const folder = desk.fs ? resolvedOrderFolder(current, settings, desk.defaultRoot) : "";
  return { added, folder, replaced: replace };
}

export async function pullMissingOrders(matter: Matter, keys?: string[]) {
  return pullOrders(matter, { keys, replace: false });
}

export async function pullAllOrders(matter: Matter) {
  return pullOrders(matter, { replace: true });
}

export function ordersSavedMessage(added: number, folder?: string, replaced?: boolean) {
  if (replaced) {
    if (!added) {
      return folder ? `Court record has no order PDFs. Folder: ${folder}` : "Court record has no order PDFs.";
    }
    if (folder) return `${added} order(s) written to ${folder}.`;
    return `${added} order(s) refreshed in the binder.`;
  }
  if (!added) return folder ? `No new orders. Folder: ${folder}` : "No new orders.";
  if (folder) return `${added} order(s) saved to ${folder}.`;
  return `${added} order(s) saved in the binder.`;
}

export async function refreshMatter(matter: Matter, seen = new Set<string>()) {
  if (seen.has(matter.id)) {
    return { ok: true as const, added: 0, folder: "", matter, replaced: true as const };
  }
  seen.add(matter.id);
  const params = lookupParamsOf(matter);
  if (!params.case_type || !params.case_no || !params.year) {
    return { ok: false as const, error: "This matter has no court lookup yet. Add it from the court site first." };
  }
  const res = await fetchCase({
    data: {
      forum: params.forum,
      bench: params.bench,
      side: params.side,
      stampreg: params.stampreg,
      case_type: params.case_type,
      case_no: params.case_no,
      year: params.year,
    },
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  const live = useBinder.getState().matters.find((m) => m.id === matter.id) ?? matter;
  const next = matterFromLookup(params, res.lookup, live);
  useBinder.getState().upsertMatter(next);
  const pulled = await pullAllOrders(next);
  const kids = useBinder
    .getState()
    .matters.filter((x) => x.parentId === next.id && x.id !== next.id && canFetchCourt(x));
  for (const k of kids) {
    await refreshMatter(k, seen);
  }
  markCommonOrders([next.id, ...kids.map((k) => k.id)]);
  useCourt.getState().log("refresh", `${next.petitioner} v ${next.respondent}`, `${pulled.added} order(s)`);
  useCourt.getState().reannotate(useBinder.getState().matters);
  return {
    ok: true as const,
    added: pulled.added,
    folder: pulled.folder,
    matter: next,
    replaced: true as const,
  };
}
