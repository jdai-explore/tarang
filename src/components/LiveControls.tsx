"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveState, Position } from "@/lib/live";
import { parseChordPro } from "@/lib/chordpro";

type Membership = { code: string; token?: string };

export default function LiveControls({ song, lyrics, chordPro }: { song?: number; lyrics?: string; chordPro?: string | null }) {
  const router = useRouter();
  const [member, setMember] = useState<Membership | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [following, setFollowing] = useState(true);
  const [error, setError] = useState("");
  const [showChords, setShowChords] = useState(false);
  const latestSeq = useRef(-1);
  const lastSend = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineElements = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tarang-live");
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
    if (!member) return;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout>;
    let stopped = false;
    let delay = 1000;
    const connect = () => {
      if (stopped) return;
      setStatus("Connecting…");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${location.host}/api/live/${member.code}/stream`);
      socket.onopen = () => { setStatus("Connected"); delay = 1000; };
      socket.onmessage = (event) => {
        try { apply(JSON.parse(event.data)); } catch {}
      };
      socket.onclose = () => {
        setStatus("Reconnecting…");
        if (!stopped) {
          reconnect = setTimeout(connect, delay + Math.random() * 500);
          delay = Math.min(delay * 2, 30000);
        }
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(reconnect); socket?.close(); };
  }, [member, apply]);

  async function join() {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(code)) { setError("Enter a six-character session code."); return; }
    const response = await fetch(`/api/live/${code}/`, { cache: "no-store" });
    if (!response.ok) { setError("That session is unavailable."); return; }
    latestSeq.current = -1;
    const next = { code };
    localStorage.setItem("tarang-live", JSON.stringify(next));
    setMember(next);
    setFollowing(true);
    setError("");
  }
  async function create() {
    const response = await fetch("/api/live/", { method: "POST" });
    if (!response.ok) { setError("Could not start a session. Check live service setup."); return; }
    const data = await response.json();
    const next = { code: data.code, token: data.token };
    localStorage.setItem("tarang-live", JSON.stringify(next));
    setMember(next);
    setState(data.state);
    setError("");
  }
  function leave() {
    localStorage.removeItem("tarang-live");
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
      if (Date.now() - lastSend.current < 300) return;
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

  return <>
    <section className="live-panel" aria-label="Live session">
      <div className="live-title"><strong>Live session</strong>{member && <span role="status">{status}</span>}</div>
      {!member ? <div className="live-actions">
        <input aria-label="Session code" placeholder="6-character code" maxLength={6} value={codeInput} onChange={(event) => setCodeInput(event.target.value)} />
        <button onClick={() => void join()}>Join</button>
        <button onClick={() => void create()}>Start as leader</button>
      </div> : <div className="live-actions">
        <span>Code: <strong>{member.code}</strong></span>
        {member.token ? <span>Leading</span> : <button onClick={() => setFollowing(!following)}>{following ? "Pause following" : "Resume following"}</button>}
        <button onClick={leave}>Leave</button>
      </div>}
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
