import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CalendarRange, Gavel, ListOrdered, Plus, RefreshCw, Timer } from "lucide-react";
import { AppBar } from "@/components/metro/app-bar";
import { Field, MetroArea, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { dayPhrase, downloadHearingsIcs, partyCaption } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
import { loadBytes } from "@/lib/binder/idb";
import { pullMissingOrders, refreshMatter } from "@/lib/binder/orders";
import { useBinder } from "@/lib/binder/store";
import { draftHearingBrief } from "@/lib/court/actions";
import type { MatterStatus, OrderMeta } from "@/lib/binder/types";
import { canFetchCourt, caseLabel, cn, downloadBlob, forumOf } from "@/lib/utils";

export const Route = createFileRoute("/docket")({ component: DocketPage });

function DocketPage() {
  const navigate = useNavigate();
  const ready = useBinder((s) => s.ready);
  const matter = useBinder((s) => s.active());
  const newMatter = useBinder((s) => s.newMatter);
  const patchDocket = useBinder((s) => s.patchDocket);
  const patchConfig = useBinder((s) => s.patchConfig);
  const stampCaptionFromDocket = useBinder((s) => s.stampCaptionFromDocket);
  const addTask = useBinder((s) => s.addTask);
  const updateTask = useBinder((s) => s.updateTask);
  const toggleTask = useBinder((s) => s.toggleTask);
  const removeTask = useBinder((s) => s.removeTask);
  const addNote = useBinder((s) => s.addNote);
  const removeNote = useBinder((s) => s.removeNote);
  const addOrder = useBinder((s) => s.addOrder);
  const updateOrder = useBinder((s) => s.updateOrder);
  const removeOrder = useBinder((s) => s.removeOrder);
  const addIssue = useBinder((s) => s.addIssue);
  const updateIssue = useBinder((s) => s.updateIssue);
  const removeIssue = useBinder((s) => s.removeIssue);
  const status = useBinder((s) => s.status);
  const statusKind = useBinder((s) => s.statusKind);
  const setStatus = useBinder((s) => s.setStatus);
  const [taskText, setTaskText] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [note, setNote] = useState("");
  const [issueText, setIssueText] = useState("");
  const [brief, setBrief] = useState("");
  const [briefing, setBriefing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    return () => {
      if (viewer) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer]);

  if (!ready) {
    return (
      <PageShell title="docket" backTo="/">
        <p className="text-muted">Loading…</p>
      </PageShell>
    );
  }

  if (!matter) {
    return (
      <PageShell title="docket" backTo="/">
        <p className="mb-4 max-w-xl text-sm text-muted leading-relaxed">
          No matter is open. Fetch a live record from Bombay High Court, SAT or NCLT, or start a blank docket for any
          other court.
        </p>
        <div className="flex flex-wrap gap-2">
          <MetroButton variant="accent" onClick={() => void navigate({ to: "/fetch" })}>
            From court
          </MetroButton>
          <MetroButton
            onClick={() => {
              newMatter();
            }}
          >
            Blank docket
          </MetroButton>
        </div>
      </PageShell>
    );
  }

  const n = daysUntil(matter.config.hearingDate);
  const openTasks = (matter.tasks ?? []).filter((t) => !t.done).length;

  async function openOrder(o: OrderMeta) {
    const id = o.docId;
    if (!id) {
      setStatus("PDF is not downloaded yet. Refresh the matter.", "err");
      return;
    }
    const buf = await loadBytes(id);
    if (!buf) {
      setStatus("PDF is not downloaded yet. Refresh the matter.", "err");
      return;
    }
    if (viewer) URL.revokeObjectURL(viewer.url);
    setViewer({
      url: URL.createObjectURL(new Blob([buf], { type: "application/pdf" })),
      name: o.title || o.doc || "Order",
    });
  }

  async function saveOrder(o: OrderMeta) {
    const id = o.docId;
    if (!id) {
      setStatus("PDF is not downloaded yet.", "err");
      return;
    }
    const buf = await loadBytes(id);
    if (!buf) {
      setStatus("PDF is not downloaded yet.", "err");
      return;
    }
    downloadBlob(new Blob([buf], { type: "application/pdf" }), `${o.title || "order"}.pdf`);
  }

  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <PageShell title={partyCaption(matter).toLowerCase()} backTo="/" backLabel="start">
        <p className="mb-8 max-w-2xl text-sm text-muted leading-relaxed text-pretty">
          This is the case, not the PDF. Fetch from Bombay High Court, SAT or NCLT for the live record — or type parties
          and the next listing by hand. Open the binder when you need a compilation.
        </p>

        {forumOf(matter) ? (
          <div className="mb-8 max-w-3xl bg-chrome px-5 py-5">
            <p className="label-caps mb-2">Court record</p>
            <p className="font-mono text-sm">{caseLabel(matter) || matter.config.caseNumber}</p>
            <p className="mt-1 text-xs text-muted">
              {matter.sideLabel || matter.config.court}
              {matter.courtStatus ? ` · ${matter.courtStatus}` : ""}
              {matter.cnr ? ` · ${matter.cnr}` : ""}
              {matter.lastRefresh ? ` · refreshed ${matter.lastRefresh}` : ""}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="label-caps">Next date (court)</p>
                <p>{matter.nextListing || "—"}</p>
              </div>
              <div>
                <p className="label-caps">{forumOf(matter) === "sat" ? "AL number" : "Registered"}</p>
                <p>
                  {forumOf(matter) === "sat"
                    ? matter.lodging || "—"
                    : matter.registrationDate || "—"}
                </p>
              </div>
              <div>
                <p className="label-caps">Stage / act</p>
                <p>{[matter.stage, matter.act].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div>
                <p className="label-caps">Petitioner’s advocate</p>
                <p>{matter.petitionerAdv || "—"}</p>
              </div>
              <div>
                <p className="label-caps">Respondent’s advocate</p>
                <p>{matter.respondentAdv || "—"}</p>
              </div>
              <div>
                <p className="label-caps">Orders</p>
                <p>
                  {matter.orders.filter((o) => o.downloaded).length}/{matter.orders.length} downloaded
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <MetroButton
                variant="accent"
                disabled={refreshing || !canFetchCourt(matter)}
                onClick={async () => {
                  setRefreshing(true);
                  setStatus("Refreshing court record…", "busy");
                  const r = await refreshMatter(matter);
                  setRefreshing(false);
                  if (!r.ok) setStatus(r.error, "err");
                  else setStatus(`${r.added} new order(s).`, "ok");
                }}
              >
                {refreshing ? "Refreshing…" : "Refresh from court"}
              </MetroButton>
              <MetroButton
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  setStatus("Downloading missing orders…", "busy");
                  const r = await pullMissingOrders(matter);
                  setRefreshing(false);
                  setStatus(`${r.added} order(s) saved.`, "ok");
                }}
              >
                Download missing orders
              </MetroButton>
              <MetroButton
                onClick={() => {
                  try {
                    const n = downloadHearingsIcs([matter]);
                    setStatus(`Exported ${n} calendar event${n === 1 ? "" : "s"}.`, "ok");
                  } catch (e) {
                    setStatus(e instanceof Error ? e.message : "No upcoming dates.", "err");
                  }
                }}
              >
                Calendar
              </MetroButton>
            </div>
          </div>
        ) : (
          <p className="mb-6 max-w-xl text-sm text-muted">
            This docket is manual. To pull parties, next date and orders from the court website, add it{" "}
            <button type="button" className="text-accent" onClick={() => void navigate({ to: "/fetch" })}>
              from court
            </button>
            .
          </p>
        )}

        {n != null ? (
          <div className={cn("mb-8 max-w-xl px-5 py-6", n <= 0 ? "bg-tile-crimson" : "bg-tile-cyan")}>
            <p className="label-caps text-fg/80">Next listing</p>
            <p className="font-display text-4xl font-light leading-none">{dayPhrase(n)}</p>
            <p className="mt-2 text-sm text-fg/85">
              {matter.config.hearingDate}
              {matter.lastCoram ? ` · ${matter.lastCoram}` : ""}
              {matter.stage ? ` · ${matter.stage}` : ""}
            </p>
          </div>
        ) : null}

        <div className="mb-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field label="Petitioner / plaintiff">
            <MetroInput
              value={matter.petitioner}
              onChange={(e) => patchDocket({ petitioner: e.target.value })}
            />
          </Field>
          <Field label="Respondent / defendant">
            <MetroInput
              value={matter.respondent}
              onChange={(e) => patchDocket({ respondent: e.target.value })}
            />
          </Field>
          <Field label="Court / forum" hint="Type whatever the cause title needs — High Court, NCLT, SAT, arbitration…">
            <MetroInput
              value={matter.config.court}
              onChange={(e) => patchConfig({ court: e.target.value })}
            />
          </Field>
          <Field label="Case number">
            <MetroInput
              value={matter.config.caseNumber}
              onChange={(e) => patchConfig({ caseNumber: e.target.value })}
            />
          </Field>
          <Field label="Next listing">
            <MetroInput
              type="date"
              value={matter.config.hearingDate}
              onChange={(e) => patchConfig({ hearingDate: e.target.value })}
            />
          </Field>
          <Field label="Stage">
            <MetroInput
              value={matter.stage}
              onChange={(e) => patchDocket({ stage: e.target.value })}
              placeholder="Admission, evidence, s. 9…"
            />
          </Field>
          <Field label="Status">
            <MetroSelect
              value={matter.status}
              onChange={(e) => patchDocket({ status: e.target.value as MatterStatus })}
            >
              <option value="Pending">Pending</option>
              <option value="Disposed">Disposed</option>
            </MetroSelect>
          </Field>
          <Field label="Appearing for">
            <MetroInput
              value={matter.config.appearingFor}
              onChange={(e) => patchConfig({ appearingFor: e.target.value })}
              placeholder="the Petitioner"
            />
          </Field>
          <Field label="Last coram">
            <MetroInput
              value={matter.lastCoram}
              onChange={(e) => patchDocket({ lastCoram: e.target.value })}
            />
          </Field>
          <Field label="Filed on">
            <MetroInput
              type="date"
              value={matter.filedOn}
              onChange={(e) => patchDocket({ filedOn: e.target.value })}
            />
          </Field>
          <Field label="Counsel on record">
            <MetroInput value={matter.partner} onChange={(e) => patchDocket({ partner: e.target.value })} />
          </Field>
          <Field label="With">
            <MetroInput value={matter.associates} onChange={(e) => patchDocket({ associates: e.target.value })} />
          </Field>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <MetroButton
            variant="accent"
            onClick={() => {
              stampCaptionFromDocket();
              void navigate({ to: "/binder" });
            }}
          >
            Write caption & open binder
          </MetroButton>
          <MetroButton onClick={() => stampCaptionFromDocket()}>Write caption from parties</MetroButton>
        </div>

        <section className="mb-12 max-w-3xl">
          <p className="label-caps mb-3">Next steps · {openTasks} open</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <MetroInput
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="File additional affidavit…"
            />
            <MetroInput type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <MetroButton
              onClick={() => {
                if (!taskText.trim()) return;
                addTask({ text: taskText.trim(), due: taskDue });
                setTaskText("");
                setTaskDue("");
              }}
            >
              Add
            </MetroButton>
          </div>
          {(matter.tasks ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing queued. Pin a step before the listing.</p>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {(matter.tasks ?? []).map((t) => {
                const d = daysUntil(t.due);
                return (
                  <li key={t.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center border-2 border-fg",
                        t.done && "bg-accent border-accent",
                      )}
                      onClick={() => toggleTask(t.id)}
                      aria-label={t.done ? "Mark open" : "Mark done"}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <MetroInput value={t.text} onChange={(e) => updateTask(t.id, { text: e.target.value })} />
                      <div className="flex flex-wrap items-center gap-3">
                        <MetroInput
                          type="date"
                          className="max-w-44"
                          value={t.due}
                          onChange={(e) => updateTask(t.id, { due: e.target.value })}
                        />
                        <span className={cn("text-xs", d != null && d < 0 && !t.done ? "text-err" : "text-muted")}>
                          {t.done ? "Done" : d == null ? "" : dayPhrase(d)}
                        </span>
                      </div>
                    </div>
                    <MetroButton variant="danger" className="min-h-9 px-3 text-xs" onClick={() => removeTask(t.id)}>
                      Remove
                    </MetroButton>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-12 max-w-3xl">
          <p className="label-caps mb-3">Hearing notes</p>
          <p className="mb-3 text-sm text-muted">What the court said, what you must do. Private to this device.</p>
          <MetroArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Stood over. File…" />
          <div className="mt-3">
            <MetroButton
              onClick={() => {
                if (!note.trim()) return;
                addNote(note.trim());
                setNote("");
              }}
            >
              Save note
            </MetroButton>
          </div>
          <ul className="mt-4 space-y-3">
            {(matter.hearingNotes ?? []).map((n) => (
              <li key={n.id} className="bg-chrome p-4">
                <p className="text-sm leading-relaxed text-pretty">{n.text}</p>
                <p className="mt-2 text-xs text-muted">{n.date}</p>
                <MetroButton variant="danger" className="mt-3 min-h-9 px-3 text-xs" onClick={() => removeNote(n.id)}>
                  Remove
                </MetroButton>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12 max-w-3xl">
          <p className="label-caps mb-3">Issues to argue · {(matter.issues ?? []).length}</p>
          <p className="mb-3 text-sm text-muted">
            Grounds, propositions, or issues for trial. Tag the papers you will open on each one — they surface in hearing.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="min-w-[220px] flex-1">
              <MetroInput
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                placeholder="Whether the circular is ultra vires…"
              />
            </div>
            <MetroButton
              onClick={() => {
                if (!issueText.trim()) return;
                addIssue({ text: issueText.trim() });
                setIssueText("");
              }}
            >
              Add issue
            </MetroButton>
          </div>
          {(matter.issues ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing framed yet. One line per proposition is enough.</p>
          ) : (
            <ul className="space-y-4">
              {(matter.issues ?? []).map((iss, idx) => (
                <li key={iss.id} className="bg-chrome p-4 space-y-3">
                  <p className="label-caps">Issue {idx + 1}</p>
                  <MetroInput value={iss.text} onChange={(e) => updateIssue(iss.id, { text: e.target.value })} />
                  <Field label="Note / pinpoint">
                    <MetroInput
                      value={iss.note}
                      onChange={(e) => updateIssue(iss.id, { note: e.target.value })}
                      placeholder="Swiss Ribbons · paras 43–52"
                    />
                  </Field>
                  {matter.docs.length ? (
                    <div>
                      <p className="label-caps mb-2">Papers</p>
                      <div className="flex flex-wrap gap-2">
                        {matter.docs.map((d) => {
                          const on = iss.docIds.includes(d.id);
                          const label = (d.bookmark || d.filename).replace(/\.pdf$/i, "");
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                const docIds = on
                                  ? iss.docIds.filter((x) => x !== d.id)
                                  : [...iss.docIds, d.id];
                                updateIssue(iss.id, { docIds });
                              }}
                              className={cn(
                                "max-w-full truncate px-3 py-2 text-left text-xs uppercase tracking-wider",
                                on ? "bg-accent text-accent-fg" : "bg-bg text-muted",
                              )}
                            >
                              {label.length > 36 ? label.slice(0, 34) + "…" : label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <MetroButton variant="danger" className="min-h-9 px-3 text-xs" onClick={() => removeIssue(iss.id)}>
                    Remove
                  </MetroButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-12 max-w-3xl">
          <p className="label-caps mb-3">Orders · {(matter.orders ?? []).length}</p>
          <p className="mb-3 text-sm text-muted">
            {canFetchCourt(matter)
              ? "Fetched from the court website. View opens the PDF in this page; Save downloads it."
              : "Manual diary of what came on the last date — or add the matter from court to pull PDFs."}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <MetroButton onClick={() => addOrder({ title: "Order", coram: matter.lastCoram })}>
              Add order by hand
            </MetroButton>
            {canFetchCourt(matter) ? (
              <MetroButton
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  setStatus("Downloading missing orders…", "busy");
                  const r = await pullMissingOrders(matter);
                  setRefreshing(false);
                  setStatus(`${r.added} order(s) saved.`, "ok");
                }}
              >
                Download missing
              </MetroButton>
            ) : null}
          </div>
          {viewer ? (
            <div className="mb-4 border border-line">
              <div className="flex items-center justify-between bg-chrome px-4 py-2">
                <p className="truncate text-sm">{viewer.name}</p>
                <MetroButton
                  className="min-h-9 px-3 text-xs"
                  onClick={() => {
                    URL.revokeObjectURL(viewer.url);
                    setViewer(null);
                  }}
                >
                  Close
                </MetroButton>
              </div>
              <iframe title={viewer.name} src={viewer.url} className="h-[70vh] w-full bg-bg" />
            </div>
          ) : null}
          <ul className="space-y-4">
            {[...(matter.orders ?? [])]
              .sort((a, b) =>
                b.date.split("/").reverse().join("").localeCompare(a.date.split("/").reverse().join("")),
              )
              .map((o) => (
                <li key={o.id} className="bg-chrome p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{o.title || o.doc || "Order"}</p>
                      <p className="text-xs text-muted">
                        {o.date || "—"}
                        {o.coram ? ` · ${o.coram}` : ""}
                        {o.downloaded ? " · downloaded" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.docId || o.downloaded ? (
                        <>
                          <MetroButton
                            className="min-h-9 px-3 text-xs"
                            onClick={() => void openOrder(o)}
                          >
                            View
                          </MetroButton>
                          <MetroButton
                            className="min-h-9 px-3 text-xs"
                            onClick={() => void saveOrder(o)}
                          >
                            Save
                          </MetroButton>
                        </>
                      ) : null}
                      <MetroButton variant="danger" className="min-h-9 px-3 text-xs" onClick={() => removeOrder(o.id)}>
                        Remove
                      </MetroButton>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title">
                      <MetroInput value={o.title} onChange={(e) => updateOrder(o.id, { title: e.target.value })} />
                    </Field>
                    <Field label="Date">
                      <MetroInput value={o.date} onChange={(e) => updateOrder(o.id, { date: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Coram">
                    <MetroInput value={o.coram} onChange={(e) => updateOrder(o.id, { coram: e.target.value })} />
                  </Field>
                  <Field label="Holding / excerpt">
                    <MetroArea rows={3} value={o.excerpt} onChange={(e) => updateOrder(o.id, { excerpt: e.target.value })} />
                  </Field>
                </li>
              ))}
          </ul>
        </section>

        <section className="max-w-3xl">
          <p className="label-caps mb-3">Hearing brief</p>
          <p className="mb-3 text-sm text-muted leading-relaxed">
            Drafted from the last orders, open tasks and hearing notes. You start it — it is never run in the background.
          </p>
          <MetroButton
            disabled={briefing}
            onClick={async () => {
              setBriefing(true);
              setStatus("Drafting hearing brief…", "busy");
              const res = await draftHearingBrief({
                data: {
                  caption: partyCaption(matter),
                  caseno: caseLabel(matter) || matter.config.caseNumber,
                  status: matter.courtStatus || matter.status,
                  listing: matter.config.hearingDate || matter.nextListing,
                  coram: matter.lastCoram,
                  tasks: (matter.tasks ?? []).filter((s) => !s.done).map((s) => s.text),
                  notes: (matter.hearingNotes ?? []).map((n) => n.text).filter(Boolean),
                  excerpts: (matter.orders ?? [])
                    .filter((o) => o.excerpt)
                    .slice(0, 3)
                    .map((o) => ({
                      date: o.date,
                      doc: o.doc || o.title,
                      text: o.excerpt || "",
                    })),
                },
              });
              setBriefing(false);
              if (!res.ok) {
                setStatus(res.error, "err");
                return;
              }
              setBrief(res.text);
              setStatus("Brief drafted.", "ok");
            }}
          >
            {briefing ? "Drafting…" : "Draft brief"}
          </MetroButton>
          {brief ? (
            <pre className="mt-4 whitespace-pre-wrap bg-chrome p-4 font-sans text-sm leading-relaxed">{brief}</pre>
          ) : (
            <p className="mt-3 text-sm text-muted">Download orders first so the brief can quote the last operative directions.</p>
          )}
        </section>
      </PageShell>
      <AppBar
        status={status}
        statusKind={statusKind}
        actions={[
          {
            id: "binder",
            label: "Binder",
            icon: <BookOpen />,
            accent: true,
            onClick: () => void navigate({ to: "/binder" }),
          },
          {
            id: "hearing",
            label: "Hearing",
            icon: <Gavel />,
            onClick: () => void navigate({ to: "/hearing" }),
          },
          {
            id: "task",
            label: "Add task",
            icon: <Plus />,
            onClick: () => addTask(),
          },
        ]}
        overflow={[
          {
            id: "refresh",
            label: "Refresh court",
            icon: <RefreshCw />,
            disabled: refreshing || !canFetchCourt(matter),
            onClick: () => {
              void (async () => {
                setRefreshing(true);
                setStatus("Refreshing court record…", "busy");
                const r = await refreshMatter(matter);
                setRefreshing(false);
                if (!r.ok) setStatus(r.error, "err");
                else setStatus(`${r.added} new order(s).`, "ok");
              })();
            },
          },
          {
            id: "toa",
            label: "Authorities",
            icon: <ListOrdered />,
            onClick: () => void navigate({ to: "/toa" }),
          },
          {
            id: "chrono",
            label: "Chronology",
            icon: <CalendarRange />,
            onClick: () => void navigate({ to: "/chrono" }),
          },
          {
            id: "desk",
            label: "Limitation desk",
            icon: <Timer />,
            onClick: () => void navigate({ to: "/desk" }),
          },
        ]}
      />
    </main>
  );
}
