"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseChordPro } from "@/lib/chordpro";

export default function ChordProTool() {
  const [input, setInput] = useState("");
  const converted = useMemo(() => input.split("\n").map((line) => {
    if (/^\s*(verse|chorus|bridge)(?:\s+\d+)?\s*:?\s*$/i.test(line)) return `{comment: ${line.trim()}}`;
    return line;
  }).join("\n"), [input]);
  const preview = useMemo(() => parseChordPro(converted), [converted]);
  return <main className="shell tool-page">
    <Link className="back" href="/">← Song list</Link>
    <h1>ChordPro paste preview</h1>
    <p>Paste text with chords written as <code>[Am]</code> before words. Section headings are converted to comments. Review the result, then copy it into a song's <code>chordPro</code> field in <code>content/songs.json</code>. Plain lyrics cannot supply missing chords.</p>
    <label htmlFor="chord-input">Paste chord-marked text</label>
    <textarea id="chord-input" value={input} onChange={(event) => setInput(event.target.value)} rows={12} />
    <h2>Preview</h2>
    <div className="chord-preview" aria-live="polite">{preview.map((line, index) => <div key={index}>
      {line.section ? <strong>{line.section}</strong> : line.parts?.map((part, partIndex) => <span className="chord-part" key={partIndex}>{part.chord && <span className="chord">{part.chord}</span>}{part.text}</span>)}
    </div>)}</div>
    <h2>ChordPro source</h2>
    <textarea readOnly aria-label="ChordPro source" value={converted} rows={12} onFocus={(event) => event.target.select()} />
  </main>;
}
