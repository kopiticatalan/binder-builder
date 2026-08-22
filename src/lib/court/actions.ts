import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const lookupSchema = z.object({
  forum: z.enum(["bhc", "sat", "nclt"]).optional(),
  bench: z.string().optional(),
  side: z.string(),
  stampreg: z.enum(["R", "S"]),
  case_type: z.string(),
  case_no: z.string(),
  year: z.string(),
});

export const fetchCaseTypes = createServerFn({ method: "POST" })
  .validator(z.object({ side: z.string() }))
  .handler(async ({ data }) => {
    try {
      const { getCaseTypes } = await import("./client.server");
      const types = await getCaseTypes(data.side);
      return { ok: true as const, types };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not load case types.",
        types: [] as { value: string; label: string }[],
      };
    }
  });

export const fetchCase = createServerFn({ method: "POST" })
  .validator(lookupSchema)
  .handler(async ({ data }) => {
    try {
      if (data.forum === "sat") {
        const { lookupSatCase } = await import("./sat.server");
        const lookup = await lookupSatCase({
          case_type: data.case_type,
          case_no: data.case_no,
          year: data.year,
        });
        return { ok: true as const, lookup };
      }
      if (data.forum === "nclt") {
        const { lookupNcltCase } = await import("./nclt.server");
        const lookup = await lookupNcltCase({
          bench: data.bench || "9",
          case_type: data.case_type,
          case_no: data.case_no,
          year: data.year,
        });
        return { ok: true as const, lookup };
      }
      const { lookupCase } = await import("./client.server");
      const lookup = await lookupCase(data);
      return { ok: true as const, lookup };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not find that case.",
      };
    }
  });

export const fetchOrderPdfs = createServerFn({ method: "POST" })
  .validator(
    lookupSchema.extend({
      keys: z.array(z.string()),
      petitioner: z.string().optional(),
      respondent: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { keys, petitioner, respondent, ...params } = data;
      if (params.forum === "sat") {
        const { downloadSatOrders } = await import("./sat.server");
        const files = await downloadSatOrders(
          {
            case_type: params.case_type,
            case_no: params.case_no,
            year: params.year,
          },
          keys,
          { petitioner, respondent },
        );
        return { ok: true as const, files };
      }
      if (params.forum === "nclt") {
        const { downloadNcltOrders } = await import("./nclt.server");
        const files = await downloadNcltOrders(
          {
            bench: params.bench || "9",
            case_type: params.case_type,
            case_no: params.case_no,
            year: params.year,
          },
          keys,
          { petitioner, respondent },
        );
        return { ok: true as const, files };
      }
      const { downloadOrders } = await import("./client.server");
      const files = await downloadOrders(params, keys, {
        petitioner,
        respondent,
      });
      return { ok: true as const, files };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not download orders.",
        files: [],
      };
    }
  });

export const fetchCauselistJudges = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.string() }))
  .handler(async ({ data }) => {
    try {
      const { listCauselistDay } = await import("./client.server");
      const judges = await listCauselistDay(data.date);
      return { ok: true as const, judges };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not load the cause list.",
        judges: [],
      };
    }
  });

export const scanCauselistBatch = createServerFn({ method: "POST" })
  .validator(
    z.object({
      items: z.array(
        z.object({
          href: z.string(),
          judge: z.string(),
          list_type: z.string(),
        }),
      ),
      watched: z.array(z.string()),
      tracked: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { scanCauselistPdfs } = await import("./client.server");
      const hits = await scanCauselistPdfs(data);
      return { ok: true as const, hits };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Cause-list scan failed.",
        hits: [],
      };
    }
  });

export const downloadCauselistPdf = createServerFn({ method: "POST" })
  .validator(
    z.object({
      date: z.string(),
      judge: z.string(),
      list_type: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { fetchCauselistPdf } = await import("./client.server");
      const file = await fetchCauselistPdf(data);
      if (!file) return { ok: false as const, error: "Could not fetch that cause list." };
      return { ok: true as const, file };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not fetch that cause list.",
      };
    }
  });

export const scanNcltLists = createServerFn({ method: "POST" })
  .validator(
    z.object({
      dates: z.array(z.string()),
      watched: z.array(z.string()),
      tracked: z.array(z.string()),
      benches: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { scanNcltCauselists } = await import("./nclt.server");
      const hits = await scanNcltCauselists(data);
      return { ok: true as const, hits };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "NCLT cause-list scan failed.",
        hits: [],
      };
    }
  });

export const scanSatLists = createServerFn({ method: "POST" })
  .validator(
    z.object({
      dates: z.array(z.string()),
      watched: z.array(z.string()),
      tracked: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { scanSatCauselists } = await import("./sat.server");
      const hits = await scanSatCauselists(data);
      return { ok: true as const, hits };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "SAT cause-list scan failed.",
        hits: [],
      };
    }
  });

export const resolveListing = createServerFn({ method: "POST" })
  .validator(
    z.object({
      forum: z.enum(["bhc", "sat", "nclt"]).optional(),
      abbr: z.string(),
      stampreg: z.enum(["R", "S"]),
      no: z.string(),
      year: z.string(),
      bench: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      if (data.forum === "sat") {
        const { lookupSatCase, SAT_APPEAL_TYPES, padSatNo } = await import("./sat.server");
        const type =
          SAT_APPEAL_TYPES.find(
            (t) => t.label.toUpperCase() === data.abbr.toUpperCase(),
          ) || SAT_APPEAL_TYPES[0];
        const params = {
          forum: "sat" as const,
          side: "2",
          stampreg: "R" as const,
          case_type: type.value,
          case_no: padSatNo(data.no),
          year: data.year,
        };
        const lookup = await lookupSatCase({
          case_type: params.case_type,
          case_no: params.case_no,
          year: params.year,
        });
        return { ok: true as const, params, type_name: type.label, lookup };
      }
      if (data.forum === "nclt") {
        const { lookupNcltCase, ncltTypeFromAbbr } = await import("./nclt.server");
        const params = {
          forum: "nclt" as const,
          bench: data.bench || "9",
          side: "2",
          stampreg: "R" as const,
          case_type: ncltTypeFromAbbr(data.abbr),
          case_no: data.no,
          year: data.year,
        };
        const lookup = await lookupNcltCase({
          bench: params.bench,
          case_type: params.case_type,
          case_no: params.case_no,
          year: params.year,
        });
        return { ok: true as const, params, type_name: data.abbr || "NCLT", lookup };
      }
      const { resolveListingAdd } = await import("./client.server");
      const resolved = await resolveListingAdd(data);
      return { ok: true as const, ...resolved };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not add that matter.",
      };
    }
  });

export const draftHearingBrief = createServerFn({ method: "POST" })
  .validator(
    z.object({
      caption: z.string(),
      caseno: z.string(),
      status: z.string().optional(),
      listing: z.string().optional(),
      coram: z.string().optional(),
      tasks: z.array(z.string()),
      notes: z.array(z.string()),
      excerpts: z.array(z.object({ date: z.string(), doc: z.string(), text: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI briefing is not available in this environment." };
    }
    const orderBlock = data.excerpts
      .slice(0, 3)
      .map(
        (o, i) =>
          `Order ${i + 1} (${o.date} · ${o.doc}):\n${o.text.slice(0, 1800)}`,
      )
      .join("\n\n");
    const prompt = `You are a chambers junior briefing counsel for a Bombay High Court listing. Write a tight hearing note. No fluff. Use short headings.

Matter: ${data.caption}
Case: ${data.caseno}
Status: ${data.status || "—"}
Next listing/hearing: ${data.listing || "—"}
Last coram: ${data.coram || "—"}

Open next steps:
${data.tasks.length ? data.tasks.map((t) => `- ${t}`).join("\n") : "- none recorded"}

Hearing notes:
${data.notes.length ? data.notes.map((t) => `- ${t}`).join("\n") : "- none recorded"}

${orderBlock || "No order text available."}

Structure:
1. Caption & listing
2. What the last order actually did
3. Issues likely to be called
4. Papers / next steps still open
5. Suggested ask of the Court (one paragraph)

Plain professional English. Do not invent facts that are not in the materials.`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 700,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        return { ok: false as const, error: `Briefing failed (${res.status}).` };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content?.trim() || "";
      if (!text) return { ok: false as const, error: "The model returned an empty brief." };
      return { ok: true as const, text };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Briefing failed.",
      };
    }
  });
