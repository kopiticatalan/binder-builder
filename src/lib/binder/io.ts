import JSZip from "jszip";
import { newId } from "@/lib/utils";
import { columnsFrom, DEFAULT_CONFIG } from "./templates";
import { migrateMatter } from "./migrate";
import type { BinderConfig, Column, Matter, PageNumPos } from "./types";

interface LegacyTemplate {
  causeTitle?: string;
  docTitle?: string;
  indexHeading?: string;
  fontFamily?: BinderConfig["fontFamily"];
  baseSize?: number;
  pageSize?: BinderConfig["pageSize"];
  pnSize?: number;
  pnBold?: boolean;
  pnPos?: PageNumPos;
  headerFill?: string;
  borders?: boolean;
  numberingMode?: BinderConfig["numberingMode"];
  exhibitScheme?: BinderConfig["exhibitScheme"];
  columns?: Omit<Column, "id">[];
  config?: Partial<BinderConfig>;
}

export function templateFromJson(raw: unknown): { config: BinderConfig; columns: Column[] } {
  const t = (raw || {}) as LegacyTemplate;
  const config: BinderConfig = {
    ...DEFAULT_CONFIG,
    ...(t.config || {}),
    causeTitle: t.causeTitle ?? t.config?.causeTitle ?? DEFAULT_CONFIG.causeTitle,
    docTitle: t.docTitle ?? t.config?.docTitle ?? DEFAULT_CONFIG.docTitle,
    indexHeading: t.indexHeading ?? t.config?.indexHeading ?? DEFAULT_CONFIG.indexHeading,
    fontFamily: t.fontFamily ?? t.config?.fontFamily ?? "times",
    baseSize: t.baseSize ?? t.config?.baseSize ?? 12,
    pageSize: t.pageSize ?? t.config?.pageSize ?? "a4",
    pageNum: {
      size: t.pnSize ?? t.config?.pageNum?.size ?? 20,
      bold: t.pnBold ?? t.config?.pageNum?.bold ?? true,
      pos: t.pnPos ?? t.config?.pageNum?.pos ?? "tr",
    },
    headerFill: t.headerFill ?? t.config?.headerFill ?? "#D9D9D9",
    borders: t.borders ?? t.config?.borders ?? true,
    numberingMode: t.numberingMode ?? t.config?.numberingMode ?? "continuous",
    exhibitScheme: t.exhibitScheme ?? t.config?.exhibitScheme ?? "none",
  };
  const cols = t.columns || [];
  const columns = cols.length
    ? cols.map((c) => ({ id: newId(), name: c.name, type: c.type, weight: c.weight }))
    : columnsFrom({
        id: "imported",
        name: "Imported",
        blurb: "",
        tile: "cyan",
        config: {},
        columns: [
          { name: "Sr No.", type: "serial", weight: 8 },
          { name: "Particulars", type: "text", weight: 70 },
          { name: "Pages", type: "pages", weight: 22 },
        ],
      });
  return { config, columns };
}

export async function parseBackupZip(file: File): Promise<{ matter: Matter; buffers: Record<string, ArrayBuffer> }> {
  const zip = await JSZip.loadAsync(file);
  const jsonFile = zip.file("binder.json");
  if (!jsonFile) throw new Error("Not a Binder Builder backup (missing binder.json).");
  const raw = JSON.parse(await jsonFile.async("string")) as Matter;
  const matter = migrateMatter(raw);
  const buffers: Record<string, ArrayBuffer> = {};
  await Promise.all(
    matter.docs.map(async (d) => {
      const entry =
        zip.file(`papers/${d.filename}`) ||
        zip.file(d.filename) ||
        Object.values(zip.files).find((f) => f.name.endsWith("/" + d.filename) && !f.dir);
      if (!entry) return;
      const buf = await entry.async("arraybuffer");
      buffers[d.id] = buf;
    }),
  );
  return { matter, buffers };
}
