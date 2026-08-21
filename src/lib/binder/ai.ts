import { createServerFn } from "@tanstack/react-start";

export type AssistKind = "caption" | "citation" | "holding" | "outline";

export const grokAssist = createServerFn({ method: "POST" })
  .validator((input: { kind: AssistKind; text: string }) => {
    const text = String(input?.text || "").trim().slice(0, 8000);
    if (!text) throw new Error("Nothing to parse");
    const kind: AssistKind =
      input.kind === "caption" || input.kind === "holding" || input.kind === "outline" ? input.kind : "citation";
    return { kind, text };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available in this environment." };

    const system =
      data.kind === "caption"
        ? `You format Indian / common-law court captions for Binder Builder.
Return ONLY the caption using these marks, no markdown fences:
- Each line is centred unless it starts with L:
- L: left-aligns the line
- A tab character between a party name and its designation pushes the designation to the right margin
- Wrap bold phrases in **double asterisks**
- Blank lines create vertical space
Preserve court, bench, case numbers, and party roles. Fill nothing the user left as [placeholders] unless the source already has the value.`
        : data.kind === "holding"
          ? `From the first pages of a judgement, extract a one-paragraph holding a junior counsel can open on.
Return compact JSON only: {"name":"Party v. Party","cite":"neutral or reporter cite","holding":"2-4 sentences, ratio only","paras":"paragraph numbers if visible"}`
          : data.kind === "outline"
            ? `You are junior counsel preparing oral submissions for an Indian / common-law hearing.
Given the caption, starred authorities (with pinpoints and notes), and any draft outline, write a tight speaking note:
- 6 to 12 numbered propositions
- each proposition names the authority and pinpoint
- no rhetoric, no markdown fences
Return plain text only.`
            : `Extract the principal case citation from the first pages of a judgement PDF.
Return compact JSON only: {"name":"Party v. Party","cite":"neutral or reporter cite","court":"","date":""}
name is bold-style short title (not all caps). cite is the best reporter/neutral cite. If unknown, empty string.`;

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: data.kind === "outline" ? 900 : 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `xAI API error ${res.status}` };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return { ok: false as const, error: "Empty model response" };

    if (data.kind === "citation" || data.kind === "holding") {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { ok: false as const, error: "Could not parse model JSON" };
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          name?: string;
          cite?: string;
          court?: string;
          date?: string;
          holding?: string;
          paras?: string;
        };
        if (data.kind === "holding") {
          return {
            ok: true as const,
            kind: "holding" as const,
            name: String(parsed.name || ""),
            cite: String(parsed.cite || ""),
            holding: String(parsed.holding || ""),
            paras: String(parsed.paras || ""),
          };
        }
        return {
          ok: true as const,
          kind: "citation" as const,
          name: String(parsed.name || ""),
          cite: String(parsed.cite || ""),
          court: String(parsed.court || ""),
          date: String(parsed.date || ""),
        };
      } catch {
        return { ok: false as const, error: "Could not parse JSON" };
      }
    }

    if (data.kind === "outline") {
      return { ok: true as const, kind: "outline" as const, text };
    }

    return { ok: true as const, kind: "caption" as const, text };
  });
