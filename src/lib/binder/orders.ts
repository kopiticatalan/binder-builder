import { PDFDocument } from "pdf-lib";
import { fetchCase, fetchOrderPdfs } from "@/lib/court/client";
import { autoBookmark } from "./guess";
import { saveBytes } from "./idb";
import { matterFromLookup, lookupParamsOf } from "./court-map";
import { useBinder } from "./store";
import { useCourt } from "./court-store";
import { blankDoc } from "./types";
import type { Matter } from "./types";
import { newId } from "@/lib/utils";

function b64ToBuf(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function ingestOrderFile(
  matter: Matter,
  file: { key: string; filename: string; base64: string; excerpt?: string },
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
  const doc = blankDoc({
    id: docId,
    filename: file.filename,
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
          ? { ...o, downloaded: true, excerpt: file.excerpt || o.excerpt, docId: doc.id }
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

export async function pullMissingOrders(matter: Matter, keys?: string[]) {
  const want = keys ?? matter.orders.filter((o) => o.key && !o.downloaded).map((o) => o.key!);
  if (!want.length) return { added: 0 };
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
      await ingestOrderFile(current, f);
      added += 1;
    }
  }
  return { added };
}

export async function refreshMatter(matter: Matter) {
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
  const missing = next.orders.filter((o) => o.key && !o.downloaded).map((o) => o.key!);
  const pulled = await pullMissingOrders(next, missing);
  useCourt.getState().log("refresh", `${next.petitioner} v ${next.respondent}`, `${pulled.added} new order(s)`);
  useCourt.getState().reannotate(useBinder.getState().matters);
  return { ok: true as const, added: pulled.added, matter: next };
}
