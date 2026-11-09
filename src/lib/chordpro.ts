export type ChordLine = { section?: string; parts?: { chord?: string; text: string }[] };

export function parseChordPro(source: string): ChordLine[] {
  return source.split("\n").map((line) => {
    const directive = line.match(/^\{(?:start_of_|sov|soc|c:|comment:)([^}]*)\}$/i);
    if (directive) return { section: directive[1].replace(/^(?:verse|chorus):?\s*/i, (match) => match.trim()) || "Section" };
    const parts: { chord?: string; text: string }[] = [];
    const expression = /\[([^\]]+)\]([^\[]*)/g;
    const first = line.indexOf("[");
    if (first < 0) return { parts: [{ text: line || "\u00a0" }] };
    if (first > 0) parts.push({ text: line.slice(0, first) });
    for (const match of line.matchAll(expression)) parts.push({ chord: match[1], text: match[2] || "\u00a0" });
    return { parts };
  });
}
