import { hasLocalCourtApi } from "@/lib/court/local";
import { nextDate, partyCaption } from "./docket";
import { daysUntil } from "./dates";
import { runCauselistScan } from "./scan";
import { useBinder } from "./store";
import { useCourt } from "./court-store";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let started = false;

function pingHearings() {
  const settings = useCourt.getState().settings;
  if (!settings.notify || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const matters = useBinder.getState().matters.filter((m) => m.status !== "Disposed");
  const today = matters.filter((m) => daysUntil(nextDate(m)) === 0);
  const tomorrow = matters.filter((m) => daysUntil(nextDate(m)) === 1);
  if (today.length) {
    new Notification("Hearings today", {
      body: today
        .slice(0, 3)
        .map((m) => partyCaption(m))
        .join(" · "),
    });
  } else if (tomorrow.length) {
    new Notification("Hearings tomorrow", {
      body: tomorrow
        .slice(0, 3)
        .map((m) => partyCaption(m))
        .join(" · "),
    });
  }
}

async function tick(reason: "open" | "timer") {
  if (running) return;
  if (useCourt.getState().listings.scanning) return;
  if (!(await hasLocalCourtApi())) return;
  running = true;
  const days = useCourt.getState().settings.scan_days || 5;
  try {
    if (reason === "open") useBinder.getState().setStatus("Scanning published lists…", "busy");
    await runCauselistScan(days);
  } finally {
    running = false;
  }
}

export function startAutoScan() {
  if (started) return;
  started = true;
  pingHearings();
  const settings = useCourt.getState().settings;
  if (!settings.autoScan) return;
  void tick("open");
  const mins = Math.max(10, Number(settings.scanEveryMin) || 30);
  timer = setInterval(() => {
    if (!useCourt.getState().settings.autoScan) return;
    void tick("timer");
  }, mins * 60 * 1000);
}

export function stopAutoScan() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
