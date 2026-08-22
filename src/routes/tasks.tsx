import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/metro/shell";
import { Field, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { allOpenTasks, dayPhrase, partyCaption } from "@/lib/binder/docket";
import { daysUntil } from "@/lib/binder/dates";
import { useBinder } from "@/lib/binder/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const setActive = useBinder((s) => s.setActive);
  const toggleTask = useBinder((s) => s.toggleTask);
  const addTask = useBinder((s) => s.addTask);
  const [filter, setFilter] = useState<"open" | "all" | "overdue">("open");
  const [mid, setMid] = useState(matters[0]?.id || "");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  let items = matters.flatMap((m) => (m.tasks ?? []).map((step) => ({ matter: m, step })));
  if (filter === "open") items = items.filter((x) => !x.step.done);
  if (filter === "overdue")
    items = items.filter((x) => {
      if (x.step.done) return false;
      const n = daysUntil(x.step.due);
      return n != null && n < 0;
    });
  items.sort(
    (a, b) =>
      Number(a.step.done) - Number(b.step.done) || (a.step.due || "9999").localeCompare(b.step.due || "9999"),
  );

  return (
    <PageShell title="tasks" backTo="/" backLabel="home">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
        Next steps across every matter.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {(["open", "overdue", "all"] as const).map((k) => (
          <MetroButton key={k} variant={filter === k ? "accent" : "ghost"} onClick={() => setFilter(k)}>
            {k}
          </MetroButton>
        ))}
      </div>

      {matters.length ? (
        <div className="mb-10 grid max-w-xl gap-3">
          <Field label="Add to">
            <MetroSelect value={mid || matters[0].id} onChange={(e) => setMid(e.target.value)}>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {partyCaption(m)}
                </option>
              ))}
            </MetroSelect>
          </Field>
          <Field label="Step">
            <MetroInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Serve compilation…" />
          </Field>
          <Field label="Due">
            <MetroInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <MetroButton
            variant="accent"
            onClick={() => {
              if (!text.trim()) return;
              const id = mid || matters[0].id;
              setActive(id);
              addTask({ text: text.trim(), due });
              setText("");
            }}
          >
            Add task
          </MetroButton>
        </div>
      ) : (
        <p className="mb-8 text-muted">Add a matter first, then attach a next step to it.</p>
      )}

      <p className="mb-3 text-sm text-muted">
        {items.length} {items.length === 1 ? "task" : "tasks"}
        {filter === "open" ? ` · ${allOpenTasks(matters).length} open` : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-muted">Nothing in this view.</p>
      ) : (
        <ul className="max-w-3xl divide-y divide-line border border-line">
          {items.map(({ matter, step }) => {
            const n = daysUntil(step.due);
            return (
              <li key={step.id} className="flex items-start gap-3 px-4 py-4">
                <button
                  type="button"
                  className={cn(
                    "mt-1 grid size-6 shrink-0 place-items-center border-2 border-fg",
                    step.done && "bg-accent border-accent",
                  )}
                  onClick={() => {
                    setActive(matter.id);
                    toggleTask(step.id);
                  }}
                  aria-label={step.done ? "Mark open" : "Mark done"}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setActive(matter.id);
                    void navigate({ to: "/docket" });
                  }}
                >
                  <span className={cn("block font-display text-2xl font-light leading-none", step.done && "text-muted")}>
                    {step.text}
                  </span>
                  <span className={cn("mt-1 block text-xs", n != null && n < 0 && !step.done ? "text-err" : "text-muted")}>
                    {partyCaption(matter)}
                    {n == null ? "" : ` · ${dayPhrase(n)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
