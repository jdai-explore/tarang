"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveState, Position } from "@/lib/live";
import { parseChordPro } from "@/lib/chordpro";

declare global {
  interface Window { Ably?: typeof import("ably") }
}

let ablyLoader: Promise<typeof import("ably")> | undefined;
function loadAbly() {
  if (window.Ably) return Promise.resolve(window.Ably);
  if (!ablyLoader) ablyLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.ably.com/lib/ably.min-2.30.0.js";
    script.integrity = "sha384-rEFIsedVIWDtgbXX8tgLdt3FqyhqXcyab7ICHpdt2UErA00K7lzuf2pCsBnygjZ/";
    script.crossOrigin = "anonymous";
    script.onload = () => window.Ably ? resolve(window.Ably) : reject(new Error("Ably SDK did not load"));
    script.onerror = () => reject(new Error("Could not load Ably SDK"));
    document.head.append(script);
  });
  return ablyLoader;
}

type Membership = { code: string; token?: string };

export default function LiveControls({ song, lyrics, chordPro }: { song?: number; lyrics?: string; chordPro?: string | null }) {
  const router = useRouter();
  const [member, setMember] = useState<Membership | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [following, setFollowing] = useState(true);
  const [error, setError] = useState("");
  const [showChords, setShowChords] = useState(false);
  const latestSeq = useRef(-1);
  const lastSend = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineElements = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    fetch("/api/live/status/", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAvailable(Boolean(data.available)))
      .catch(() => setAvailable(false));
    try {
      const saved = localStorage.getItem("tarang-live-ably");
      if (saved) setMember(JSON.parse(saved));
    } catch {}
    const urlCode = new URLSearchParams(location.search).get("live")?.toUpperCase();
    if (urlCode && /^[A-F0-9]{6}$/.test(urlCode)) setCodeInput(urlCode);
  }, []);

  const apply = useCallback((next: LiveState) => {
    if (next.seq < latestSeq.current) return;
    latestSeq.current = next.seq;
    setState(next);
    if (!following || member?.token) return;
    if (song !== undefined && song !== next.song) {
      router.push(`/songs/${next.song}/`);
      return;
    }
    if (song === undefined) {
      router.push(`/songs/${next.song}/`);
      return;
    }
    const line = lineElements.current[next.position.line];
    if (line) {
      const top = line.getBoundingClientRect().top + window.scrollY - window.innerHeight * next.position.fraction;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [following, member?.token, router, song]);

  useEffect(() => {
    if (!member || !available) return;
    let stopped = false;
    let client: import("ably").Realtime | null = null;
    setStatus("Connecting…");
    void loadAbly().then((Ably) => {
      if (stopped) return;
      client = new Ably.Realtime({ authUrl: `/api/live/${member.code}/auth/` });
      const channel = client.channels.get(`tarang:session:${member.code}`, { params: { rewind: "1" } });
      client.connection.on((change) => {
        if (stopped) return;
        setStatus(change.current === "connected" ? "Connected" : change.current === "failed" ? "Connection failed" : "Reconnecting…");
      });
      void channel.subscribe("state", (message) => {
        if (stopped) return;
        const next = message.data as LiveState;
        if (next?.code === member.code && Number.isFinite(next.seq)) apply(next);
      }).catch(() => { if (!stopped) setStatus("Connection failed"); });
    }).catch(() => { if (!stopped) setStatus("Connection failed"); });
    return () => { stopped = true; client?.close(); };
  }, [member, apply, available]);

  async function join() {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(code)) { setError("Enter a six-character session code."); return; }
    const response = await fetch(`/api/live/${code}/`, { cache: "no-store" });
    if (!response.ok) { setError("That session is unavailable."); return; }
    latestSeq.current = -1;
    const next = { code };
    localStorage.setItem("tarang-live-ably", JSON.stringify(next));
    setMember(next);
    setFollowing(true);
    setError("");
  }
  async function create() {
    const response = await fetch("/api/live/", { method: "POST" });
    if (!response.ok) { setError("Could not start a session. Check live service setup."); return; }
    const data = await response.json();
    const next = { code: data.code, token: data.token };
    localStorage.setItem("tarang-live-ably", JSON.stringify(next));
    setMember(next);
    setState(data.state);
    setError("");
  }
  function leave() {
    localStorage.removeItem("tarang-live-ably");
    latestSeq.current = -1;
    setMember(null);
    setState(null);
    setStatus("Disconnected");
  }
  async function send(songNumber: number, position: Position) {
    if (!member?.token) return;
    const response = await fetch(`/api/live/${member.code}/update/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: member.token, song: songNumber, position }),
    });
    if (!response.ok) setError("Could not send update. Check your connection.");
  }
  useEffect(() => {
    if (!member?.token || song === undefined || !lyrics) return;
    if (state?.song !== song) void send(song, { line: 0, fraction: 0 });
    const onScroll = () => {
      if (Date.now() - lastSend.current < 1200) return;
      lastSend.current = Date.now();
      let line = 0;
      for (let index = 0; index < lineElements.current.length; index++) {
        if ((lineElements.current[index]?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight * .35) line = index;
      }
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void send(song, { line, fraction: .35 }), 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (pending.current) clearTimeout(pending.current); };
  }, [member?.token, song, lyrics, state?.song]);

  useEffect(() => {
    if (!member?.token || !state) return;
    const heartbeat = setInterval(() => void send(state.song, state.position), 60_000);
    return () => clearInterval(heartbeat);
  }, [member?.token, state?.song, state?.position.line, state?.position.fraction]);

  return <>
    <section className="live-panel" aria-label="Live session">
      <div className="live-title"><strong>Live session</strong>{member && <span role="status">{status}</span>}</div>
      {available === false && <p className="live-note" role="status">Live sessions are not configured yet. You can still read every published song.</p>}
      {available === null && <p className="live-note" role="status">Checking live session availability…</p>}
      {available && !member ? <div className="live-actions">
        <input aria-label="Session code" placeholder="6-character code" maxLength={6} value={codeInput} onChange={(event) => setCodeInput(event.target.value)} />
        <button onClick={() => void join()}>Join</button>
        <button onClick={() => void create()}>Start as leader</button>
      </div> : available && member ? <div className="live-actions">
        <span>Code: <strong>{member.code}</strong></span>
        {member.token ? <span>Leading</span> : <button onClick={() => setFollowing(!following)}>{following ? "Pause following" : "Resume following"}</button>}
        <button onClick={leave}>Leave</button>
      </div> : null}
      {member?.token && <p className="live-note">Keep this browser open as leader. Share only the code with participants.</p>}
      {error && <p className="live-error" role="alert">{error}</p>}
    </section>
    {chordPro && <button className="chord-toggle" type="button" onClick={() => setShowChords(!showChords)}>{showChords ? "Hide chords" : "Show chords"}</button>}
    {lyrics && <div className="lyric-lines" lang="hi-Latn">{showChords && chordPro ? parseChordPro(chordPro).map((line, index) =>
      <span className="lyric-line" key={index} ref={(element) => { lineElements.current[index] = element; }}>
        {line.section ? <strong className="chord-section">{line.section}</strong> : line.parts?.map((part, partIndex) =>
          <span className="chord-part" key={partIndex}>{part.chord && <span className="chord">{part.chord}</span>}{part.text}</span>)}
      </span>
    ) : lyrics.split("\n").map((line, index) =>
      <span className="lyric-line" key={index} ref={(element) => { lineElements.current[index] = element; }}>{line || "\u00a0"}</span>
    )}</div>}
  </>;
}
