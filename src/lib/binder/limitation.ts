import { addDays, formatLongDate, toIsoDate } from "./dates";

export interface LimitationPreset {
  id: string;
  label: string;
  days: number;
  note: string;
}

export const LIMITATION_PRESETS: LimitationPreset[] = [
  { id: "suit-3y", label: "Civil suit — 3 years", days: 365 * 3, note: "Limitation Act, residuary / Art. 58–113." },
  { id: "ws-30", label: "Written statement — 30 days", days: 30, note: "Order VIII r. 1 CPC, from service." },
  { id: "ws-120", label: "Written statement outer cap — 120 days", days: 120, note: "Commercial Courts Act outer limit." },
  { id: "appeal-30", label: "First appeal — 30 days", days: 30, note: "Typical district / civil appeal." },
  { id: "appeal-90", label: "Appeal — 90 days", days: 90, note: "Many High Court first appeals." },
  { id: "slp-90", label: "SLP to Supreme Court — 90 days", days: 90, note: "Art. 136, from the impugned order." },
  { id: "review-30", label: "Review — 30 days", days: 30, note: "Order XLVII CPC." },
  { id: "exec-12y", label: "Execution — 12 years", days: 365 * 12, note: "Art. 136, from the decree becoming enforceable." },
  { id: "nclat-30", label: "NCLT → NCLAT — 30 + 15 days", days: 45, note: "s. 61 IBC: 30 days, condonable by 15." },
  { id: "s34-3m", label: "s. 34 Arbitration — 3 months + 30 days", days: 120, note: "3 months from receipt, further 30 on sufficient cause." },
  { id: "s37-90", label: "s. 37 Arbitration appeal — 90 days", days: 90, note: "Commercial Courts Act for s. 37 appeals." },
  { id: "consumer-45", label: "Consumer appeal — 45 days", days: 45, note: "State / National Commission, condonable." },
  { id: "drt-45", label: "DRT appeal to DRAT — 45 days", days: 45, note: "RDDBFI Act." },
  { id: "crim-60", label: "Criminal revision / appeal — 60 days", days: 60, note: "Typical CrPC appeal window; confirm the section." },
];

export function computeLimitation(fromIso: string, presetId: string) {
  const preset = LIMITATION_PRESETS.find((p) => p.id === presetId);
  const start = new Date(fromIso);
  if (!preset || Number.isNaN(start.getTime())) return null;
  const due = addDays(start, preset.days);
  return {
    preset,
    due,
    iso: toIsoDate(due),
    label: formatLongDate(due),
  };
}
