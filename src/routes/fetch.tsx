import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Field, MetroButton, MetroInput, MetroSelect } from "@/components/metro/controls";
import { PageShell } from "@/components/metro/shell";
import { Pivot } from "@/components/metro/pivot";
import { fetchCase, fetchCaseTypes } from "@/lib/court/client";
import { courtFailMessage } from "@/lib/court/local";
import { matterFromLookup } from "@/lib/binder/court-map";
import { useCourt } from "@/lib/binder/court-store";
import { ordersSavedMessage, pullMissingOrders } from "@/lib/binder/orders";
import { blankMatter } from "@/lib/binder/templates";
import { useBinder } from "@/lib/binder/store";
import type { CaseType, Forum, StampReg } from "@/lib/types";
import { NCLT_BENCHES, NCLT_CASE_TYPES, SAT_APPEAL_TYPES } from "@/lib/types";

export const Route = createFileRoute("/fetch")({ component: FetchPage });

function FetchPage() {
  const navigate = useNavigate();
  const matters = useBinder((s) => s.matters);
  const upsertMatter = useBinder((s) => s.upsertMatter);
  const setActive = useBinder((s) => s.setActive);
  const setStatus = useBinder((s) => s.setStatus);
  const status = useBinder((s) => s.status);
  const statusKind = useBinder((s) => s.statusKind);
  const log = useCourt((s) => s.log);

  const [forum, setForum] = useState<Forum>("bhc");
  const [bench, setBench] = useState("9");
  const [side, setSide] = useState("2");
  const [stampreg, setStampreg] = useState<StampReg>("R");
  const [types, setTypes] = useState<CaseType[]>([]);
  const [caseType, setCaseType] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [claimant, setClaimant] = useState("");
  const [respondent, setRespondent] = useState("");
  const [institution, setInstitution] = useState("");
  const [seat, setSeat] = useState("Mumbai");
  const [tribunal, setTribunal] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (forum === "arb") {
      setLoadingTypes(false);
      return;
    }
    if (forum === "sat") {
      setTypes([...SAT_APPEAL_TYPES]);
      setCaseType((cur) => cur || SAT_APPEAL_TYPES[0].value);
      setLoadingTypes(false);
      return;
    }
    if (forum === "nclt") {
      setTypes([...NCLT_CASE_TYPES]);
      setCaseType((cur) => cur || NCLT_CASE_TYPES[0].value);
      setLoadingTypes(false);
      return;
    }
    let cancelled = false;
    setLoadingTypes(true);
    setStatus("Loading Bombay High Court case types…", "busy");
    fetchCaseTypes({ data: { side } })
      .then((r) => {
        if (cancelled) return;
        setLoadingTypes(false);
        if (!r.ok) {
          setStatus(r.error, "err");
          setTypes([]);
          return;
        }
        setTypes(r.types);
        setCaseType((cur) => cur || r.types[0]?.value || "");
        setStatus("Case types loaded from bombayhighcourt.gov.in.", "ok");
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadingTypes(false);
        setStatus(courtFailMessage(e), "err");
      });
    return () => {
      cancelled = true;
    };
  }, [side, forum, setStatus]);

  async function onSave() {
    if (forum === "arb") {
      if (!claimant.trim() && !respondent.trim()) {
        setStatus("Enter the parties.", "err");
        return;
      }
      const matter = blankMatter();
      matter.forum = "arb";
      matter.petitioner = claimant.trim();
      matter.respondent = respondent.trim();
      matter.caseNo = caseNo.trim();
      matter.year = year.trim();
      matter.institution = institution.trim();
      matter.tribunal = tribunal.trim();
      matter.seat = seat.trim();
      matter.typeName = "Arbitration";
      matter.benchLabel = tribunal.trim();
      matter.sideLabel = seat.trim() || "Arbitration";
      matter.config.court = [institution.trim(), seat.trim()].filter(Boolean).join(" · ") || "Arbitration";
      matter.config.caseNumber = [institution.trim(), caseNo.trim(), year.trim()].filter(Boolean).join(" ");
      matter.config.hearingDate = hearingDate;
      matter.name = `${matter.petitioner} v ${matter.respondent}`.replace(/^ v | v$/g, "") || "Arbitration";
      upsertMatter(matter);
      setActive(matter.id);
      log("add", matter.name, "Arbitration");
      setStatus("Arbitration file saved.", "ok");
      void navigate({ to: "/docket" });
      return;
    }
    const type =
      types.find((t) => t.value === caseType) ||
      SAT_APPEAL_TYPES.find((t) => t.value === caseType) ||
      NCLT_CASE_TYPES.find((t) => t.value === caseType);
    if (!caseType || !caseNo.trim() || !/^\d{4}$/.test(year)) {
      setStatus("Pick a type, then enter the case number and a four-digit year.", "err");
      return;
    }
    setSaving(true);
    setStatus("Finding the court record…", "busy");
    const params = {
      forum,
      bench: forum === "nclt" ? bench : undefined,
      side: forum === "bhc" ? side : "2",
      stampreg: forum === "bhc" ? stampreg : ("R" as StampReg),
      case_type: caseType,
      case_no: caseNo.trim(),
      year,
    };
    try {
      const res = await fetchCase({ data: params });
      if (!res.ok) {
        setStatus(res.error, "err");
        setSaving(false);
        return;
      }
      const satId = ["sat", caseType, caseNo.trim().replace(/\D/g, "").padStart(4, "0"), year].join("|");
      const ncltId = ["nclt", bench, caseType, caseNo.trim().replace(/\D/g, ""), year].join("|");
      const bhcId = [side, stampreg, caseType, caseNo.trim(), year].join("|");
      const existing = matters.find(
        (m) => m.id === (forum === "sat" ? satId : forum === "nclt" ? ncltId : bhcId),
      );
      const matter = matterFromLookup({ ...params, type_name: type?.label || "" }, res.lookup, existing);
      upsertMatter(matter);
      log("add", `${matter.petitioner} v ${matter.respondent}`, "From court site");
      setStatus("Matter saved. Downloading orders…", "busy");
      const pulled = await pullMissingOrders(matter);
      setStatus(ordersSavedMessage(pulled.added, pulled.folder), "ok");
      setCaseNo("");
      void navigate({ to: "/docket" });
    } catch (e) {
      setStatus(courtFailMessage(e), "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="add from court" backTo="/" backLabel="home">
      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed text-pretty">
        Look up Bombay High Court, SAT or NCLT. Or add an arbitration — there is no court website to scrape, so that
        file is yours to keep.
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

      <div className="mb-8">
        <Pivot
          tabs={[
            { id: "bhc", label: "High Court" },
            { id: "sat", label: "SAT" },
            { id: "nclt", label: "NCLT" },
            { id: "arb", label: "Arbitration" },
          ]}
          value={forum}
          onChange={(id) => {
            setForum(id as Forum);
            setCaseType("");
          }}
        />
      </div>

      <p className="mb-6 max-w-xl text-sm text-muted leading-relaxed">
        {forum === "sat"
          ? "SEBI, IRDAI or PFRDA appeal as it appears on the SAT cause list. Records come from sat.gov.in."
          : forum === "nclt"
            ? "NCLT case number as published. Mumbai is selected by default. Records come from the e-filing portal."
            : forum === "arb"
              ? "No scrape. Seat, institution and tribunal stay on this file. Next date is yours to type."
              : "Case types load from bombayhighcourt.gov.in after you pick Original or Appellate Side."}
      </p>

      <div className="mb-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        {forum === "bhc" ? (
          <>
            <Field label="Side">
              <MetroSelect value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="2">Original Side</option>
                <option value="1">Appellate Side</option>
              </MetroSelect>
            </Field>
            <Field label="Register / stamp">
              <MetroSelect value={stampreg} onChange={(e) => setStampreg(e.target.value as StampReg)}>
                <option value="R">Registered</option>
                <option value="S">Stamp / lodging</option>
              </MetroSelect>
            </Field>
            <Field label="Case type" hint={loadingTypes ? "Loading from the High Court site…" : undefined}>
              <MetroSelect value={caseType} disabled={loadingTypes} onChange={(e) => setCaseType(e.target.value)}>
                {loadingTypes ? (
                  <option>Loading types…</option>
                ) : types.length ? (
                  types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))
                ) : (
                  <option value="">Could not load types</option>
                )}
              </MetroSelect>
            </Field>
            <Field label="Case number">
              <MetroInput
                inputMode="numeric"
                placeholder="e.g. 1842"
                value={caseNo}
                onChange={(e) => setCaseNo(e.target.value)}
              />
            </Field>
            <Field label="Year">
              <MetroInput
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
          </>
        ) : forum === "sat" ? (
          <>
            <Field label="Appeal type">
              <MetroSelect value={caseType} onChange={(e) => setCaseType(e.target.value)}>
                {SAT_APPEAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </MetroSelect>
            </Field>
            <Field label="Appeal number">
              <MetroInput
                inputMode="numeric"
                placeholder="e.g. 246"
                value={caseNo}
                onChange={(e) => setCaseNo(e.target.value)}
              />
            </Field>
            <Field label="Year">
              <MetroInput
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
          </>
        ) : forum === "nclt" ? (
          <>
            <Field label="Bench">
              <MetroSelect value={bench} onChange={(e) => setBench(e.target.value)}>
                {NCLT_BENCHES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </MetroSelect>
            </Field>
            <Field label="Case type">
              <MetroSelect value={caseType} onChange={(e) => setCaseType(e.target.value)}>
                {NCLT_CASE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </MetroSelect>
            </Field>
            <Field label="Case number">
              <MetroInput
                inputMode="numeric"
                placeholder="e.g. 3025"
                value={caseNo}
                onChange={(e) => setCaseNo(e.target.value)}
              />
            </Field>
            <Field label="Year">
              <MetroInput
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Claimant">
              <MetroInput value={claimant} onChange={(e) => setClaimant(e.target.value)} />
            </Field>
            <Field label="Respondent">
              <MetroInput value={respondent} onChange={(e) => setRespondent(e.target.value)} />
            </Field>
            <Field label="Institution">
              <MetroInput placeholder="MCIA / SIAC / ad hoc" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </Field>
            <Field label="Seat">
              <MetroInput value={seat} onChange={(e) => setSeat(e.target.value)} />
            </Field>
            <Field label="Tribunal">
              <MetroInput placeholder="Arbitrator(s)" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
            </Field>
            <Field label="Reference no.">
              <MetroInput value={caseNo} onChange={(e) => setCaseNo(e.target.value)} />
            </Field>
            <Field label="Year">
              <MetroInput inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field label="Your next date">
              <MetroInput type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      <MetroButton variant="accent" disabled={saving} onClick={() => void onSave()}>
        {saving ? "Finding…" : forum === "arb" ? "Save arbitration" : "Find and save"}
      </MetroButton>
      <p className="mt-4 max-w-xl text-xs text-muted leading-relaxed">
        Existing notes, tasks and binder papers are kept if you add the same case again. Use the Mac
        app for High Court / SAT / NCLT lookup — the public web page cannot reach court sites.
      </p>
    </PageShell>
  );
}
