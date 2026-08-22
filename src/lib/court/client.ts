import {
  downloadCauselistPdf as rpcDownloadCauselistPdf,
  fetchCase as rpcFetchCase,
  fetchCaseTypes as rpcFetchCaseTypes,
  fetchCauselistJudges as rpcFetchCauselistJudges,
  fetchOrderPdfs as rpcFetchOrderPdfs,
  resolveListing as rpcResolveListing,
  scanCauselistBatch as rpcScanCauselistBatch,
  scanBhcDay as rpcScanBhcDay,
  scanNcltLists as rpcScanNcltLists,
  scanSatLists as rpcScanSatLists,
} from "./actions";
import { tryLocal } from "./local";

export async function fetchCaseTypes(args: { data: { side: string } }) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcFetchCaseTypes>>>(
    "fetch-case-types",
    args.data,
  );
  if (local) return local;
  return rpcFetchCaseTypes(args);
}

export async function fetchCase(args: Parameters<typeof rpcFetchCase>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcFetchCase>>>("fetch-case", args.data);
  if (local) return local;
  return rpcFetchCase(args);
}

export async function fetchOrderPdfs(args: Parameters<typeof rpcFetchOrderPdfs>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcFetchOrderPdfs>>>(
    "fetch-orders",
    args.data,
  );
  if (local) return local;
  return rpcFetchOrderPdfs(args);
}

export async function fetchCauselistJudges(args: { data: { date: string } }) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcFetchCauselistJudges>>>(
    "fetch-causelist-judges",
    args.data,
  );
  if (local) return local;
  return rpcFetchCauselistJudges(args);
}

export async function scanCauselistBatch(args: Parameters<typeof rpcScanCauselistBatch>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcScanCauselistBatch>>>(
    "scan-causelist-batch",
    args.data,
  );
  if (local) return local;
  return rpcScanCauselistBatch(args);
}

export async function scanBhcDay(args: Parameters<typeof rpcScanBhcDay>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcScanBhcDay>>>("scan-bhc-day", args.data);
  if (local) return local;
  return rpcScanBhcDay(args);
}

export async function downloadCauselistPdf(args: Parameters<typeof rpcDownloadCauselistPdf>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcDownloadCauselistPdf>>>(
    "download-causelist-pdf",
    args.data,
  );
  if (local) return local;
  return rpcDownloadCauselistPdf(args);
}

export async function scanNcltLists(args: Parameters<typeof rpcScanNcltLists>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcScanNcltLists>>>("scan-nclt", args.data);
  if (local) return local;
  return rpcScanNcltLists(args);
}

export async function scanSatLists(args: Parameters<typeof rpcScanSatLists>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcScanSatLists>>>("scan-sat", args.data);
  if (local) return local;
  return rpcScanSatLists(args);
}

export async function resolveListing(args: Parameters<typeof rpcResolveListing>[0]) {
  const local = await tryLocal<Awaited<ReturnType<typeof rpcResolveListing>>>(
    "resolve-listing",
    args.data,
  );
  if (local) return local;
  return rpcResolveListing(args);
}
