import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { useBinder } from "@/lib/binder/store";
import { TYPE_LABELS, type ColumnType, type Matter } from "@/lib/binder/types";

export function IndexPanel({ matter }: { matter: Matter }) {
  const addColumn = useBinder((s) => s.addColumn);
  const updateColumn = useBinder((s) => s.updateColumn);
  const moveColumn = useBinder((s) => s.moveColumn);
  const removeColumn = useBinder((s) => s.removeColumn);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="label-caps pb-2 pr-3">Column</th>
              <th className="label-caps pb-2 pr-3">Content</th>
              <th className="label-caps pb-2 pr-3">Width</th>
              <th className="label-caps pb-2" />
            </tr>
          </thead>
          <tbody>
            {matter.columns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  <MetroInput value={c.name} onChange={(e) => updateColumn(c.id, { name: e.target.value })} />
                </td>
                <td className="py-2 pr-3">
                  <MetroSelect
                    value={c.type}
                    onChange={(e) => updateColumn(c.id, { type: e.target.value as ColumnType })}
                  >
                    {Object.entries(TYPE_LABELS).map(([k, lab]) => (
                      <option key={k} value={k}>
                        {lab}
                      </option>
                    ))}
                  </MetroSelect>
                </td>
                <td className="w-24 py-2 pr-3">
                  <MetroInput
                    type="number"
                    min={1}
                    value={c.weight}
                    onChange={(e) => updateColumn(c.id, { weight: parseFloat(e.target.value) || 1 })}
                  />
                </td>
                <td className="whitespace-nowrap py-2">
                  <div className="flex gap-1">
                    <MetroButton className="min-h-11 px-2" onClick={() => moveColumn(c.id, -1)} aria-label="Move up">
                      <ChevronUp className="size-4" />
                    </MetroButton>
                    <MetroButton className="min-h-11 px-2" onClick={() => moveColumn(c.id, 1)} aria-label="Move down">
                      <ChevronDown className="size-4" />
                    </MetroButton>
                    <MetroButton className="min-h-11 px-2" variant="danger" onClick={() => removeColumn(c.id)}>
                      <X className="size-4" />
                    </MetroButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MetroButton onClick={addColumn}>
        <Plus className="size-4" /> Add column
      </MetroButton>
      <p className="text-xs text-muted">Starred papers print an asterisk on the serial (authorities to be read).</p>
    </div>
  );
}
