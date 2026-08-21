import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/metro/shell";

export const Route = createFileRoute("/guide")({ component: GuidePage });

const BLOCKS = [
  {
    title: "Caption marks",
    body: "Every line of the cause title is centred unless it starts with L:. Wrap a phrase in **double asterisks** to bold it. Put a tab between a party’s name and “…Petitioner” to send the designation to the right margin — the same convention as a Word right-aligned tab.",
  },
  {
    title: "What the build does",
    body: "Cover and index are laid out first so page ranges are real. Source PDFs are merged in list order, optional divider sheets inserted, then every page is stamped. Bookmarks open the PDF sidebar. Index page ranges can be hyperlinks. Starred-only builds a thin convenience volume for the bench.",
  },
  {
    title: "Papers",
    body: "Drop PDFs in hearing order — several at once; duplicates are skipped. Use page-from / page-to to keep only the holding. Star the authorities you will actually open. Kind tags (authority, exhibit, pleading…) drive chronology. Read cite and Holding pull the first pages.",
  },
  {
    title: "Hearing mode",
    body: "A full-screen deck of starred authorities. Swipe or use the arrows. Pinpoints, holding, and a private speaking note sit on one screen so you are not scrolling a 400-page PDF at the lectern.",
  },
  {
    title: "Chronology and TOA",
    body: "Chronology sorts on the date column. Table of authorities groups Supreme Court, High Courts, NCLT/NCLAT and the rest. Both export as Word.",
  },
  {
    title: "Limitation desk",
    body: "Working calculator for common Indian windows (suit, WS, SLP, s. 34, NCLAT). Pin the due date onto the matter. Confirm the article before you diary it — this is not legal advice.",
  },
  {
    title: "Volumes",
    body: "Set a page cap on Style (many registries dislike files over ~250 pages). The build splits into Volume I of N, each with its own cover and index, and downloads a zip.",
  },
  {
    title: "Stamps and gutters",
    body: "DRAFT / CONFIDENTIAL / PRIVILEGED watermarks sit under the text. A binding gutter adds left margin for a comb or hole punch. Bates prefixes format as P-000001.",
  },
  {
    title: "Where files live",
    body: "Matters and PDFs are stored in this browser only. Nothing is uploaded except when you tap Clean caption, Read cite, Holding or Draft from starred. Use Backup zip before switching machines. Ctrl+Z undoes the last edit.",
  },
];

function GuidePage() {
  return (
    <PageShell title="how to" backTo="/" backLabel="start">
      <ol className="max-w-2xl space-y-8">
        {BLOCKS.map((b, i) => (
          <li key={b.title}>
            <p className="font-display text-3xl font-light text-accent">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 font-display text-3xl font-light">{b.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{b.body}</p>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
