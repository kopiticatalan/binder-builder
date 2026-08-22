import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Field, MetroButton, MetroCheck, MetroInput, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { WatchListEditor } from "@/components/metro/watch-list";
import { useCourt } from "@/lib/binder/court-store";
import { parseImportPayload } from "@/lib/binder/import-tracker";
import { NAME_PRESETS, DEFAULT_ORDER_PATTERN, formatOrderFilename } from "@/lib/binder/order-files";
import { requestNotify } from "@/lib/binder/scan";
import { useBinder } from "@/lib/binder/store";
import { chooseFolder, deskFs, openFolder, type DeskFs } from "@/lib/court/fs";
import { publicUrl } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const settings = useCourt((s) => s.settings);
  const setSettings = useCourt((s) => s.setSettings);
  const listings = useCourt((s) => s.listings);
  const activity = useCourt((s) => s.activity);
  const log = useCourt((s) => s.log);
  const matters = useBinder((s) => s.matters);
  const importTrackerMatters = useBinder((s) => s.importTrackerMatters);
  const loadPractice = useBinder((s) => s.loadPractice);
  const clearSample = useBinder((s) => s.clearSample);
  const setStatus = useBinder((s) => s.setStatus);
  const status = useBinder((s) => s.status);
  const statusKind = useBinder((s) => s.statusKind);
  const [desk, setDesk] = useState<DeskFs | null>(null);

  useEffect(() => {
    void deskFs().then(setDesk);
  }, []);

  const defaultRoot = desk?.defaultRoot || "~/Desktop/Bombay HC matters";
  const root = settings.orderRoot || defaultRoot;
  const pattern = settings.orderNamePattern || DEFAULT_ORDER_PATTERN;
  const known = NAME_PRESETS.some((p) => p.pattern === pattern);
  const preview = formatOrderFilename({
    pattern,
    seq: 1,
    date: "25/08/2026",
    pet: "Divine Decor",
    resp: "Municipal Corporation",
    caseno: "WP/5306/2026",
    doc: "Order",
    srl: "01",
    year: "2026",
  });

  return (
    <PageShell title="settings" backTo="/" backLabel="home">
      <p className="mb-8 max-w-xl text-sm text-muted leading-relaxed text-pretty">
        Firms we watch, where orders land, how many days to scan, alerts, backup.
      </p>
      {status && statusKind !== "idle" ? (
        <p
          className={
            statusKind === "err"
              ? "mb-6 max-w-xl text-sm text-err"
              : statusKind === "ok"
                ? "mb-6 max-w-xl text-sm text-ok"
                : "mb-6 max-w-xl text-sm text-accent"
          }
        >
          {status}
        </p>
      ) : null}

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Firms we watch</p>
        <WatchListEditor />
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Orders on disk</p>
        <p className="mb-4 text-sm text-muted leading-relaxed">
          {desk?.fs
            ? "Each matter gets a subfolder under this root, named Petitioner v Respondent — unless you set a folder on that docket. Same idea as the original tracker: Desktop/Bombay HC matters by default."
            : "In the Mac app, orders also write to a folder you pick (Desktop/Bombay HC matters by default, then Petitioner v Respondent). Override that on each docket. On this public page they stay in the binder; tap Save on an order to download one PDF."}
        </p>
        <Field
          label="Default folder"
          hint="Leave blank for Desktop/Bombay HC matters. Each matter uses a subfolder unless you override it on the docket."
        >
          <MetroInput
            value={settings.orderRoot}
            placeholder={defaultRoot}
            onChange={(e) => setSettings({ orderRoot: e.target.value })}
          />
        </Field>
        {desk?.fs ? (
          <div className="mt-3 mb-6 flex flex-wrap gap-2">
            <MetroButton
              onClick={async () => {
                const r = await chooseFolder("Default folder for court orders");
                if (r?.ok && r.path) {
                  setSettings({ orderRoot: r.path });
                  setStatus("Default order folder saved.", "ok");
                } else if (r && !r.ok && r.error !== "Cancelled.") {
                  setStatus(r.error || "Could not pick a folder.", "err");
                }
              }}
            >
              Choose folder
            </MetroButton>
            <MetroButton
              onClick={async () => {
                const r = await openFolder(root);
                if (!r?.ok) setStatus(r?.error || "Could not open that folder.", "err");
              }}
            >
              Open folder
            </MetroButton>
          </div>
        ) : (
          <div className="mt-3 mb-6" />
        )}
        <Field
          label="Default file name"
          hint="{seq} oldest=1 · {date} 25082026 · {date_dmy} 25-08-2026 · {pet} {resp} {caseno} {doc} {srl} {year}"
        >
          <MetroSelect
            value={known ? pattern : "__custom"}
            onChange={(e) => {
              if (e.target.value === "__custom") return;
              setSettings({ orderNamePattern: e.target.value });
            }}
          >
            {NAME_PRESETS.map((p) => (
              <option key={p.pattern} value={p.pattern}>
                {p.label}
              </option>
            ))}
            <option value="__custom">Custom pattern…</option>
          </MetroSelect>
        </Field>
        {!known ? (
          <div className="mt-3">
            <MetroInput
              value={pattern}
              onChange={(e) => setSettings({ orderNamePattern: e.target.value })}
            />
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted font-mono leading-relaxed">{preview}</p>
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Cause lists</p>
        <Field label="Scan horizon" hint="Days ahead to include when you tap Scan.">
          <MetroSelect
            className="max-w-40"
            value={String(settings.scan_days)}
            onChange={(e) => setSettings({ scan_days: Number(e.target.value) })}
          >
            {[3, 5, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </MetroSelect>
        </Field>
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Notifications</p>
        <MetroCheck
          checked={settings.notify}
          onChange={async (v) => {
            if (v) await requestNotify();
            setSettings({ notify: v });
          }}
          label="Alert when one of your matters is listed today"
        />
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Data</p>
        <p className="mb-4 text-sm text-muted leading-relaxed">
          Export a JSON backup, or import the original Matter Tracker{" "}
          <span className="font-mono">matters.json</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <MetroButton
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify({ matters, settings, listings }, null, 2)],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "binder-matters.json";
              a.click();
              URL.revokeObjectURL(url);
              setStatus("Backup downloaded.", "ok");
            }}
          >
            Export JSON
          </MetroButton>
          <label className="inline-flex min-h-11 cursor-pointer items-center bg-chrome px-4 text-sm font-semibold uppercase tracking-wider">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const json = JSON.parse(await file.text());
                  const incoming = parseImportPayload(json);
                  if (!incoming.length) {
                    setStatus("No matters found in that file.", "err");
                    return;
                  }
                  const r = importTrackerMatters(incoming);
                  log("import", `Imported ${r.added + r.updated} matter(s)`);
                  setStatus(`Imported ${r.added} new, updated ${r.updated}.`, "ok");
                } catch {
                  setStatus("Could not read that JSON file.", "err");
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Mac app</p>
        <p className="mb-4 text-sm text-muted leading-relaxed">
          Unzip, drag Binder Builder into Applications, then right-click → Open. Needs Python 3
          (already on a Mac, or xcode-select --install). No Node. High Court, SAT and NCLT fetch
          only work in this Mac app — not on the public web page.
        </p>
        <a href={publicUrl("Binder-Builder-for-Mac.zip")} download="Binder-Builder-for-Mac.zip">
          <MetroButton variant="accent">Download for Mac</MetroButton>
        </a>
      </section>

      <section className="mb-10 max-w-xl">
        <p className="label-caps mb-3">Sample</p>
        <p className="mb-4 text-sm text-muted">Four fictional Bombay High Court matters to look around.</p>
        <div className="flex flex-wrap gap-2">
          <MetroButton
            onClick={() => {
              loadPractice();
            }}
          >
            Load sample
          </MetroButton>
          <MetroButton variant="danger" onClick={() => clearSample()}>
            Remove sample
          </MetroButton>
        </div>
      </section>

      {activity.length ? (
        <section className="max-w-xl">
          <p className="label-caps mb-3">Activity</p>
          <ul className="divide-y divide-line border border-line">
            {activity.slice(0, 12).map((ev) => (
              <li key={ev.id} className="px-4 py-3">
                <p className="text-sm">{ev.title}</p>
                <p className="text-xs text-muted">
                  {ev.at}
                  {ev.detail ? ` · ${ev.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
