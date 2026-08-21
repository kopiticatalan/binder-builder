import { Field, MetroCheck, MetroInput, MetroSelect } from "@/components/metro/controls";
import { useBinder } from "@/lib/binder/store";
import type {
  ExhibitScheme,
  FontFamily,
  Matter,
  NumberingMode,
  PageNumPos,
  PageSize,
  Watermark,
} from "@/lib/binder/types";

export function StylePanel({ matter }: { matter: Matter }) {
  const patchConfig = useBinder((s) => s.patchConfig);
  const cfg = matter.config;

  return (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
      <Field label="Font">
        <MetroSelect
          value={cfg.fontFamily}
          onChange={(e) => patchConfig({ fontFamily: e.target.value as FontFamily })}
        >
          <option value="times">Times New Roman</option>
          <option value="helvetica">Arial / Helvetica</option>
        </MetroSelect>
      </Field>
      <Field label="Base size (pt)">
        <MetroInput
          type="number"
          min={8}
          max={16}
          step={0.5}
          value={cfg.baseSize}
          onChange={(e) => patchConfig({ baseSize: parseFloat(e.target.value) || 12 })}
        />
      </Field>
      <Field label="Page size">
        <MetroSelect value={cfg.pageSize} onChange={(e) => patchConfig({ pageSize: e.target.value as PageSize })}>
          <option value="a4">A4</option>
          <option value="letter">Letter (8.5 × 11)</option>
          <option value="legal">Legal (8.5 × 14)</option>
        </MetroSelect>
      </Field>
      <Field label="Header row shade">
        <div className="flex gap-2">
          <input
            type="color"
            value={cfg.headerFill}
            onChange={(e) => patchConfig({ headerFill: e.target.value })}
            className="h-11 w-14 shrink-0 border-0 bg-chrome p-1"
          />
          <MetroInput value={cfg.headerFill} onChange={(e) => patchConfig({ headerFill: e.target.value })} />
        </div>
      </Field>
      <Field label="Page no. size (pt)">
        <MetroInput
          type="number"
          min={8}
          max={48}
          value={cfg.pageNum.size}
          onChange={(e) => patchConfig({ pageNum: { ...cfg.pageNum, size: parseFloat(e.target.value) || 20 } })}
        />
      </Field>
      <Field label="Page no. style">
        <MetroSelect
          value={cfg.pageNum.bold ? "1" : "0"}
          onChange={(e) => patchConfig({ pageNum: { ...cfg.pageNum, bold: e.target.value === "1" } })}
        >
          <option value="1">Bold</option>
          <option value="0">Regular</option>
        </MetroSelect>
      </Field>
      <Field label="Page no. position">
        <MetroSelect
          value={cfg.pageNum.pos}
          onChange={(e) => patchConfig({ pageNum: { ...cfg.pageNum, pos: e.target.value as PageNumPos } })}
        >
          <option value="tr">Top right</option>
          <option value="tc">Top centre</option>
          <option value="br">Bottom right</option>
          <option value="bc">Bottom centre</option>
        </MetroSelect>
      </Field>
      <Field label="Numbering">
        <MetroSelect
          value={cfg.numberingMode}
          onChange={(e) => patchConfig({ numberingMode: e.target.value as NumberingMode })}
        >
          <option value="continuous">Continuous from cover (1…)</option>
          <option value="romanCover">Roman cover, Arabic papers</option>
          <option value="docsOnly">Papers only (cover unnumbered)</option>
        </MetroSelect>
      </Field>
      <Field label="Bates prefix" hint="Leave blank for ordinary numbers. Example: P → P-000001.">
        <MetroInput value={cfg.batesPrefix} onChange={(e) => patchConfig({ batesPrefix: e.target.value })} />
      </Field>
      <Field label="Stamp">
        <MetroSelect
          value={cfg.watermark}
          onChange={(e) => patchConfig({ watermark: e.target.value as Watermark })}
        >
          <option value="none">None</option>
          <option value="draft">DRAFT</option>
          <option value="confidential">CONFIDENTIAL</option>
          <option value="privilege">PRIVILEGED & CONFIDENTIAL</option>
          <option value="notForCirculation">NOT FOR CIRCULATION</option>
        </MetroSelect>
      </Field>
      <Field label="Binding gutter (mm)" hint="Extra left margin for hole-punch / comb bind.">
        <MetroInput
          type="number"
          min={0}
          max={40}
          value={cfg.gutterMm}
          onChange={(e) => patchConfig({ gutterMm: parseFloat(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Volume cap (pages)" hint="0 = one file. Otherwise split into Volume I of N when over the cap.">
        <MetroInput
          type="number"
          min={0}
          max={2000}
          value={cfg.volumeMaxPages}
          onChange={(e) => patchConfig({ volumeMaxPages: parseInt(e.target.value, 10) || 0 })}
        />
      </Field>
      <Field label="Exhibit scheme">
        <MetroSelect
          value={cfg.exhibitScheme}
          onChange={(e) => patchConfig({ exhibitScheme: e.target.value as ExhibitScheme })}
        >
          <option value="none">Manual</option>
          <option value="letters">A, B, C…</option>
          <option value="arabic">1, 2, 3…</option>
          <option value="roman">I, II, III…</option>
          <option value="annexure">ANNEXURE A…</option>
        </MetroSelect>
      </Field>
      <div className="sm:col-span-2 grid gap-2 pt-2">
        <MetroCheck
          checked={cfg.borders}
          onChange={(v) => patchConfig({ borders: v })}
          label="Table borders on the index"
        />
        <MetroCheck
          checked={cfg.hyperlinkIndex}
          onChange={(v) => patchConfig({ hyperlinkIndex: v })}
          label="Hyperlink page ranges in the PDF index"
        />
        <MetroCheck
          checked={cfg.runningHeader}
          onChange={(v) => patchConfig({ runningHeader: v })}
          label="Running header on paper pages (case no. + title)"
        />
        <MetroCheck
          checked={cfg.separatorSheets}
          onChange={(v) => patchConfig({ separatorSheets: v })}
          label="Divider sheet before each document"
        />
        <MetroCheck
          checked={cfg.certificatePage}
          onChange={(v) => patchConfig({ certificatePage: v })}
          label="Certificate of true copies after the index"
        />
      </div>
    </div>
  );
}
