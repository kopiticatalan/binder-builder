type Json = Record<string, unknown>;

function fail(e: unknown, extra: Json = {}) {
  return {
    ok: false as const,
    error: e instanceof Error ? e.message : "Court lookup failed.",
    ...extra,
  };
}

export async function dispatchCourt(op: string, data: Record<string, unknown>) {
  switch (op) {
    case "fetch-case-types": {
      try {
        const { getCaseTypes } = await import("./client.server");
        const types = await getCaseTypes(String(data.side || "2"));
        return { ok: true as const, types };
      } catch (e) {
        return fail(e, { types: [] });
      }
    }
    case "fetch-case": {
      try {
        const forum = data.forum;
        if (forum === "sat") {
          const { lookupSatCase } = await import("./sat.server");
          const lookup = await lookupSatCase({
            case_type: String(data.case_type || ""),
            case_no: String(data.case_no || ""),
            year: String(data.year || ""),
          });
          return { ok: true as const, lookup };
        }
        if (forum === "nclt") {
          const { lookupNcltCase } = await import("./nclt.server");
          const lookup = await lookupNcltCase({
            bench: String(data.bench || "9"),
            case_type: String(data.case_type || ""),
            case_no: String(data.case_no || ""),
            year: String(data.year || ""),
          });
          return { ok: true as const, lookup };
        }
        const { lookupCase } = await import("./client.server");
        const lookup = await lookupCase({
          forum: "bhc",
          side: String(data.side || "2"),
          stampreg: data.stampreg === "S" ? "S" : "R",
          case_type: String(data.case_type || ""),
          case_no: String(data.case_no || ""),
          year: String(data.year || ""),
        });
        return { ok: true as const, lookup };
      } catch (e) {
        return fail(e);
      }
    }
    case "fetch-orders": {
      try {
        const keys = Array.isArray(data.keys) ? data.keys.map(String) : [];
        const parties = {
          petitioner: data.petitioner ? String(data.petitioner) : undefined,
          respondent: data.respondent ? String(data.respondent) : undefined,
        };
        const forum = data.forum;
        if (forum === "sat") {
          const { downloadSatOrders } = await import("./sat.server");
          const files = await downloadSatOrders(
            {
              case_type: String(data.case_type || ""),
              case_no: String(data.case_no || ""),
              year: String(data.year || ""),
            },
            keys,
            parties,
          );
          return { ok: true as const, files };
        }
        if (forum === "nclt") {
          const { downloadNcltOrders } = await import("./nclt.server");
          const files = await downloadNcltOrders(
            {
              bench: String(data.bench || "9"),
              case_type: String(data.case_type || ""),
              case_no: String(data.case_no || ""),
              year: String(data.year || ""),
            },
            keys,
            parties,
          );
          return { ok: true as const, files };
        }
        const { downloadOrders } = await import("./client.server");
        const files = await downloadOrders(
          {
            forum: "bhc",
            side: String(data.side || "2"),
            stampreg: data.stampreg === "S" ? "S" : "R",
            case_type: String(data.case_type || ""),
            case_no: String(data.case_no || ""),
            year: String(data.year || ""),
          },
          keys,
          parties,
        );
        return { ok: true as const, files };
      } catch (e) {
        return fail(e, { files: [] });
      }
    }
    case "fetch-causelist-judges": {
      try {
        const { listCauselistDay } = await import("./client.server");
        const judges = await listCauselistDay(String(data.date || ""));
        return { ok: true as const, judges };
      } catch (e) {
        return fail(e, { judges: [] });
      }
    }
    case "scan-causelist-batch": {
      try {
        const { scanCauselistPdfs } = await import("./client.server");
        const items = Array.isArray(data.items)
          ? (data.items as { href: string; judge: string; list_type: string }[])
          : [];
        const hitsOut = await scanCauselistPdfs({
          items,
          watched: Array.isArray(data.watched) ? data.watched.map(String) : [],
          tracked: Array.isArray(data.tracked) ? data.tracked.map(String) : [],
          date: String(data.date || ""),
          list_folder: data.list_folder ? String(data.list_folder) : undefined,
        });
        return { ok: true as const, hits: hitsOut.hits, pdfs: hitsOut.pdfs };
      } catch (e) {
        return fail(e, { hits: [] });
      }
    }
    case "scan-bhc-day": {
      try {
        const { scanBhcDay } = await import("./client.server");
        const out = await scanBhcDay({
          date: String(data.date || ""),
          watched: Array.isArray(data.watched) ? data.watched.map(String) : [],
          tracked: Array.isArray(data.tracked) ? data.tracked.map(String) : [],
          list_folder: data.list_folder ? String(data.list_folder) : undefined,
        });
        return { ok: true as const, hits: out.hits, judges: out.judges, pdfs: out.pdfs };
      } catch (e) {
        return fail(e, { hits: [], judges: 0 });
      }
    }
    case "download-causelist-pdf": {
      try {
        const { fetchCauselistPdf } = await import("./client.server");
        const file = await fetchCauselistPdf({
          date: String(data.date || ""),
          judge: String(data.judge || ""),
          list_type: String(data.list_type || ""),
        });
        if (!file) return { ok: false as const, error: "Could not fetch that cause list." };
        return { ok: true as const, file };
      } catch (e) {
        return fail(e);
      }
    }
    case "scan-nclt": {
      try {
        const { scanNcltCauselists } = await import("./nclt.server");
        const hits = await scanNcltCauselists({
          dates: Array.isArray(data.dates) ? data.dates.map(String) : [],
          watched: Array.isArray(data.watched) ? data.watched.map(String) : [],
          tracked: Array.isArray(data.tracked) ? data.tracked.map(String) : [],
          benches: Array.isArray(data.benches) ? data.benches.map(String) : ["9"],
        });
        return { ok: true as const, hits };
      } catch (e) {
        return fail(e, { hits: [] });
      }
    }
    case "scan-sat": {
      try {
        const { scanSatCauselists } = await import("./sat.server");
        const hits = await scanSatCauselists({
          dates: Array.isArray(data.dates) ? data.dates.map(String) : [],
          watched: Array.isArray(data.watched) ? data.watched.map(String) : [],
          tracked: Array.isArray(data.tracked) ? data.tracked.map(String) : [],
        });
        return { ok: true as const, hits };
      } catch (e) {
        return fail(e, { hits: [] });
      }
    }
    case "resolve-listing": {
      try {
        const forum = data.forum;
        if (forum === "sat") {
          const { lookupSatCase, SAT_APPEAL_TYPES, padSatNo } = await import("./sat.server");
          const type =
            SAT_APPEAL_TYPES.find(
              (t) => t.label.toUpperCase() === String(data.abbr || "").toUpperCase(),
            ) || SAT_APPEAL_TYPES[0];
          const params = {
            forum: "sat" as const,
            side: "2",
            stampreg: "R" as const,
            case_type: type.value,
            case_no: padSatNo(String(data.no || "")),
            year: String(data.year || ""),
          };
          const lookup = await lookupSatCase({
            case_type: params.case_type,
            case_no: params.case_no,
            year: params.year,
          });
          return { ok: true as const, params, type_name: type.label, lookup };
        }
        if (forum === "nclt") {
          const { lookupNcltCase, ncltTypeFromAbbr } = await import("./nclt.server");
          const params = {
            forum: "nclt" as const,
            bench: String(data.bench || "9"),
            side: "2",
            stampreg: "R" as const,
            case_type: ncltTypeFromAbbr(String(data.abbr || "")),
            case_no: String(data.no || ""),
            year: String(data.year || ""),
          };
          const lookup = await lookupNcltCase({
            bench: params.bench,
            case_type: params.case_type,
            case_no: params.case_no,
            year: params.year,
          });
          return { ok: true as const, params, type_name: String(data.abbr || "NCLT"), lookup };
        }
        const { resolveListingAdd } = await import("./client.server");
        const resolved = await resolveListingAdd({
          abbr: String(data.abbr || ""),
          stampreg: data.stampreg === "S" ? "S" : "R",
          no: String(data.no || ""),
          year: String(data.year || ""),
        });
        return { ok: true as const, ...resolved };
      } catch (e) {
        return fail(e);
      }
    }
    default:
      return { ok: false as const, error: `Unknown court action: ${op}` };
  }
}
