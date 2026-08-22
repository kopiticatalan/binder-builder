import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Field, MetroButton, MetroCheck, MetroInput, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { useCourt } from "@/lib/binder/court-store";
import { parseImportPayload } from "@/lib/binder/import-tracker";
import { requestNotify } from "@/lib/binder/scan";
import { useBinder } from "@/lib/binder/store";
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
  const [watch, setWatch] = useState("");
  const [watched, setWatched] = useState(settings.watched);

  return (
    <PageShell title="settings" backTo="/" backLabel="start">
      <p className="mb-8 max-w-xl text-sm text-muted leading-relaxed text-pretty">
        Watch-list, scan horizon, notifications, and backup. Matters stay in this browser.
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
        <p className="label-caps mb-3">Watch list</p>
        <p className="mb-4 text-sm text-muted leading-relaxed">
          Cause-list scans also surface matters where these firms appear — Bombay High Court, SAT and NCLT.
        </p>
        <ul className="mb-4 space-y-2">
          {watched.map((w, i) => (
            <li key={i} className="flex gap-2">
              <MetroInput
                value={w}
                onChange={(e) => {
                  const next = [...watched];
                  next[i] = e.target.value;
                  setWatched(next);
                }}
              />
              <MetroButton
                variant="danger"
                className="min-h-11 px-3"
                onClick={() => setWatched(watched.filter((_, j) => j !== i))}
              >
                Remove
              </MetroButton>
            </li>
          ))}
        </ul>
        <div className="mb-4 flex gap-2">
          <MetroInput
            placeholder="Firm name"
            value={watch}
            onChange={(e) => setWatch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && watch.trim()) {
                setWatched([...watched, watch.trim()]);
                setWatch("");
              }
            }}
          />
          <MetroButton
            onClick={() => {
              if (!watch.trim()) return;
              setWatched([...watched, watch.trim()]);
              setWatch("");
            }}
          >
            Add
          </MetroButton>
        </div>
        <MetroButton
          variant="accent"
          onClick={() => {
            setSettings({ watched: watched.map((w) => w.trim()).filter(Boolean) });
            setStatus("Watch list saved.", "ok");
          }}
        >
          Save watch list
        </MetroButton>
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
          Unzip, drag Binder Builder into Applications, then right-click → Open. Needs Node.js from nodejs.org. First
          launch installs the rest. High Court, SAT and NCLT fetch only work in this local app — not on the public web
          page.
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
