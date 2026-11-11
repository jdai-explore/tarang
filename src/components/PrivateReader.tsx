"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Preferences from "./Preferences";
import { parseChordPro } from "@/lib/chordpro";

type Song = { number: number; title: string; title_hindi: string; film: string; language: string; lyrics: string; chord_pro: string | null };
type State = { code: string; song: number | null; position: { line: number; fraction: number }; seq: number };
type Client = { channels: { get: (name: string, options: { params: { rewind: string } }) => { subscribe: (name: string, callback: (message: { data: unknown }) => void) => Promise<unknown> } }; connection: { on: (callback: (change: { current: string }) => void) => void }; close: () => void };
declare global { interface Window { AblyPubSub?: { createClient: (options: { authUrl: string }) => Client } } }

let loading: Promise<NonNullable<Window["AblyPubSub"]>> | undefined;
function ablySdk() {
  if (window.AblyPubSub) return Promise.resolve(window.AblyPubSub);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.ably.com/lib/ably.min-3.0.0.js";
    script.integrity = "sha384-D4xqp6PP/a42kW75FzAoNwwO+jjp6xhkee/1ScepcD40gyt7N+3oNb3Cs3T6UVQF";
    script.crossOrigin = "anonymous";
    script.onload = () => window.AblyPubSub ? resolve(window.AblyPubSub) : reject(new Error("Ably unavailable"));
    script.onerror = () => reject(new Error("Ably unavailable"));
    document.head.append(script);
  });
  return loading;
}

export default function PrivateReader() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [connected, setConnected] = useState(false);
  const [following, setFollowing] = useState(true);
  const [chords, setChords] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(-1);
  const requestId = useRef(0);
  const songNumber = useRef<number | null>(null);
  const lines = useRef<(HTMLSpanElement | null)[]>([]);

  const refresh = useCallback(async (sessionCode: string) => {
    const response = await fetch(`/api/private/live/${sessionCode}/`, { cache: "no-store" });
    if (response.status === 404) {
      sessionStorage.removeItem("tarang-join-code");
      setCode(""); setSong(null); setState(null); setConnected(false);
      throw new Error("Session ended or unavailable");
    }
    if (!response.ok) throw new Error("Session temporarily unavailable");
    const next = await response.json() as State;
    if (next.seq < latest.current) return;
    latest.current = next.seq;
    setState(next);
    if (next.song !== songNumber.current) {
      const current = ++requestId.current;
      const songResponse = await fetch(`/api/private/live/${sessionCode}/song/`, { cache: "no-store" });
      if (current !== requestId.current) return;
      if (!songResponse.ok) throw new Error("Current song unavailable");
      const loaded = await songResponse.json() as Song;
      songNumber.current = loaded.number;
      setSong(loaded);
    }
    setError("");
  }, []);

  async function join() {
    const next = input.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{10}$/.test(next)) { setError("Enter the 10-character join code."); return; }
    try {
      latest.current = -1;
      await refresh(next);
      setCode(next);
      setFollowing(true);
      sessionStorage.setItem("tarang-join-code", next);
    } catch { setError("Session unavailable. Check the code with the leader."); }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("tarang-join-code");
    if (saved) { setInput(saved); void refresh(saved).then(() => setCode(saved)).catch(() => sessionStorage.removeItem("tarang-join-code")); }
  }, [refresh]);

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let client: Client | undefined;
    let subscribed = false;
    void ablySdk().then((sdk) => {
      if (stopped) return;
      client = sdk.createClient({ authUrl: `/api/private/live/${code}/auth/` });
      client.connection.on((change) => {
        if (stopped) return;
        setConnected(subscribed && change.current === "connected");
        if (change.current === "connected") void refresh(code).catch(() => setError("Session unavailable"));
      });
      const channel = client.channels.get(`tarang:session:${code}`, { params: { rewind: "1" } });
      void channel.subscribe("ended", () => {
        if (stopped) return;
        sessionStorage.removeItem("tarang-join-code");
        setSong(null); setState(null); setCode(""); setConnected(false);
        setError("The leader ended this session.");
      });
      void channel.subscribe("state", (message) => {
          const next = message.data as State;
          if (!stopped && next?.code === code && Number.isFinite(next.seq) && next.seq > latest.current) {
            latest.current = next.seq;
            setState(next);
            if (next.song !== songNumber.current) void refresh(code).catch(() => setError("Could not refresh the current song"));
          }
        }).then(() => {
          if (stopped) return;
          subscribed = true;
          setConnected(true);
          void refresh(code).catch(() => setError("Could not refresh the current song"));
        }).catch(() => { if (!stopped) { setConnected(false); setError("Live sync unavailable. Rejoin the session to retry."); } });
    }).catch(() => { if (!stopped) setConnected(false); });
    return () => { stopped = true; client?.close(); };
  }, [code, refresh]);

  useEffect(() => {
    if (!state || !song || !following || state.song !== song.number) return;
    const line = lines.current[state.position.line];
    if (line) {
      const top = line.getBoundingClientRect().top + window.scrollY - window.innerHeight * state.position.fraction;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [state, song, following, chords]);

  return <main className="shell reader">
    <div className="reader-top"><h1>Tarang</h1><Preferences showSize /></div>
    {!code ? <section className="live-panel"><p>Ask the leader for the live session code.</p>
      <input aria-label="Session code" maxLength={10} value={input} onChange={(event) => setInput(event.target.value)} placeholder="10-character code" />
      <button type="button" onClick={() => void join()}>Join session</button>
    </section> : <section className="live-panel"><p role="status">{connected ? "Live · connected" : "Reconnecting…"} · {code}</p>
      <button type="button" onClick={() => setFollowing(!following)}>{following ? "Pause following" : "Resume following"}</button>
      <button type="button" onClick={() => { sessionStorage.removeItem("tarang-join-code"); setCode(""); setSong(null); songNumber.current = null; setState(null); }}>Leave</button>
    </section>}
    {error && <p role="alert" className="live-error">{error}</p>}
    {song && <><div className="song-heading"><div className="song-number">Song {String(song.number).padStart(2, "0")}</div>
      <h2>{song.title}</h2><p className="hindi" lang="hi">{song.title_hindi}</p><p className="muted">{song.film}</p></div>
      {song.chord_pro && <button type="button" className="chord-toggle" onClick={() => setChords(!chords)}>{chords ? "Hide chords" : "Show chords"}</button>}
      <div className="lyric-lines" lang={song.language}>{chords && song.chord_pro ? parseChordPro(song.chord_pro).map((line, index) =>
        <span className="lyric-line" key={index} ref={(element) => { lines.current[index] = element; }}>
          {line.section ? <strong className="chord-section">{line.section}</strong> : line.parts?.map((part, i) => <span className="chord-part" key={i}>{part.chord && <span className="chord">{part.chord}</span>}{part.text}</span>)}
        </span>) : song.lyrics.split("\n").map((line, index) =>
        <span className="lyric-line" key={index} ref={(element) => { lines.current[index] = element; }}>{line || "\u00a0"}</span>)}</div>
    </>}
  </main>;
}
