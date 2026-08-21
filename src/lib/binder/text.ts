export interface TextRun {
  text: string;
  bold: boolean;
  ital: boolean;
}

export function parseRuns(text: string, baseBold = false, baseItal = false): TextRun[] {
  const runs: TextRun[] = [];
  String(text)
    .split("**")
    .forEach((part, idx) => {
      if (!part) return;
      runs.push({
        text: part,
        bold: idx % 2 === 1 ? !baseBold : baseBold,
        ital: baseItal,
      });
    });
  return runs.length ? runs : [{ text: "", bold: baseBold, ital: baseItal }];
}

export interface CauseLine {
  align: "center" | "left";
  left: TextRun[];
  right?: TextRun[];
  blank: boolean;
}

export function parseCauseLine(raw: string): CauseLine {
  if (raw.trim() === "") return { align: "center", left: [], blank: true };
  let align: "center" | "left" = "center";
  let s = raw;
  if (/^L:/.test(s)) {
    align = "left";
    s = s.slice(2);
  }
  if (s.includes("\t")) {
    const [l, r] = s.split("\t");
    return { align: "left", left: parseRuns(l), right: parseRuns(r), blank: false };
  }
  return { align, left: parseRuns(s), blank: false };
}

export function wrapBold(selection: string) {
  return `**${selection}**`;
}
