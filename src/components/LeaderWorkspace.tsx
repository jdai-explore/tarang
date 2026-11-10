"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Song = { id: number; number: number; title: string; title_hindi: string; film: string; language: string; lyrics: string; chord_pro: string | null };
type Playlist = { id: number; name: string; songs: { id: number; number: number; title: string }[] };
type Session = { code: string; playlist_id: number; leader_user_id: string; leader_epoch: number; song_number: number | null; line: number; fraction: number };
type Grant = { email: string; user_id: string | null; revoked_at: string | null };

export default function LeaderWorkspace({ owner, userId }: { owner: boolean; userId: string }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [edit, setEdit] = useState<Partial<Song>>({ language: "hi-Latn" });
  const [active, setActive] = useState<{ code: string; epoch: number; song: number | null } | null>(null);
  const [message, setMessage] = useState("");
  const lastSent = useRef(0);

  const load = useCallback(async () => {
    try {
      const [songResponse, playlistResponse, sessionResponse] = await Promise.all([
        fetch("/api/private/library/", { cache: "no-store" }),
        fetch("/api/private/playlists/", { cache: "no-store" }),
        fetch("/api/private/live/", { cache: "no-store" }),
      ]);
      if (!songResponse.ok || !playlistResponse.ok || !sessionResponse.ok) throw new Error("Library not prepared yet");
      setSongs(await songResponse.json());
      setPlaylists(await playlistResponse.json());
      setSessions(await sessionResponse.json());
      if (owner) {
        const grantsResponse = await fetch("/api/admin/leaders/", { cache: "no-store" });
        if (grantsResponse.ok) setGrants(await grantsResponse.json());
      }
      setMessage("");
    } catch { setMessage("Private library not ready. The owner must prepare it first."); }
  }, [owner]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);

  useEffect(() => {
    if (!active || !sessions.length) return;
    const session = sessions.find((item) => item.code === active.code);
    if (!session || session.leader_user_id !== userId || session.leader_epoch !== active.epoch) {
      setActive(null);
      setMessage("Another leader took over, or the session ended.");
    }
  }, [sessions, active, userId]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed");
    return result;
  }
  async function saveSong() {
    try {
      await post("/api/private/library/", { number: Number(edit.number), title: edit.title, titleHindi: edit.title_hindi, film: edit.film, language: edit.language, lyrics: edit.lyrics, chordPro: edit.chord_pro });
      setEdit({ language: "hi-Latn" });
      await load();
      setMessage("Song saved privately.");
    } catch (error) { setMessage((error as Error).message); }
  }
  async function savePlaylist() {
    try {
      await post("/api/private/playlists/", { name, songIds: selected });
      setName(""); setSelected([]); await load(); setMessage("Playlist saved.");
    } catch (error) { setMessage((error as Error).message); }
  }
  async function grant(action: "approve" | "revoke", address: string) {
    try { await post("/api/admin/leaders/", { action, email: address }); setEmail(""); await load(); setMessage(`Leader ${action === "approve" ? "approved" : "revoked"}.`); }
    catch (error) { setMessage((error as Error).message); }
  }
  async function start(playlistId: number) {
    try {
      const result = await post("/api/private/live/", { playlistId });
      setActive({ code: result.code, epoch: result.epoch, song: result.state.song });
      await load(); setMessage(`Live code: ${result.code}. Share only this code with followers.`);
    } catch (error) { setMessage((error as Error).message); }
  }
  async function takeover(session: Session) {
    try {
      const result = await post(`/api/private/live/${session.code}/`, { action: "takeover" });
      setActive({ code: session.code, epoch: result.epoch, song: session.song_number });
      setMessage("You are now the active leader. Confirm the song and position before scrolling.");
      await load();
    } catch (error) { setMessage((error as Error).message); }
  }
  async function update(songNumber: number, line = 0) {
    if (!active) return;
    try {
      await post(`/api/private/live/${active.code}/`, { action: "update", epoch: active.epoch, song: songNumber, position: { line, fraction: .35 } });
      setActive({ ...active, song: songNumber });
    } catch (error) { setActive(null); setMessage(`Control lost or update failed: ${(error as Error).message}`); }
  }
  async function end() {
    if (!active) return;
    try { await post(`/api/private/live/${active.code}/`, { action: "end", epoch: active.epoch }); setActive(null); await load(); setMessage("Session ended."); }
    catch (error) { setMessage((error as Error).message); }
  }
  const current = songs.find((song) => song.number === active?.song);
  const currentPlaylist = playlists.find((playlist) => playlist.id === sessions.find((session) => session.code === active?.code)?.playlist_id);

  return <div className="leader-workspace">
    <button type="button" onClick={() => void authClient.signOut().then(() => location.reload())}>Sign out</button>
    <p role="status">{message}</p>
    {owner && <section className="live-panel"><h2>Approved leaders</h2>
      <p>Only approved Gmail accounts can access this workspace or control a session.</p>
      <input aria-label="Leader Gmail address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="leader@gmail.com" />
      <button type="button" onClick={() => void grant("approve", email)}>Approve</button>
      {grants.map((item) => <p key={item.email}>{item.email} · {item.revoked_at ? "revoked" : "approved"}
        {!item.revoked_at && <button type="button" onClick={() => void grant("revoke", item.email)}>Revoke</button>}</p>)}
    </section>}
    <section className="live-panel"><h2>Live sessions</h2>
      {sessions.map((session) => <p key={session.code}>Code {session.code} · song {session.song_number ?? "—"} · {session.leader_user_id === userId ? "your account" : "another leader"}
        <button type="button" onClick={() => void takeover(session)}>{session.leader_user_id === userId ? "Resume leading" : "Take over"}</button></p>)}
      {active && <><p>Active control: <strong>{active.code}</strong></p><button type="button" onClick={() => void end()}>End session</button>
        <h3>Setlist</h3>{currentPlaylist?.songs.map((song) => <button type="button" key={song.id} onClick={() => void update(song.number)}>{song.number}. {song.title}</button>)}
        {current && <><h3>{current.title}</h3><div className="lyric-lines" style={{ maxHeight: "55vh", overflowY: "auto" }} onScroll={(event) => {
          if (Date.now() - lastSent.current < 1200) return;
          lastSent.current = Date.now();
          const container = event.currentTarget;
          const nodes = [...container.querySelectorAll(".lyric-line")];
          let line = 0;
          for (let i = 0; i < nodes.length; i++) if (nodes[i].getBoundingClientRect().top <= container.getBoundingClientRect().top + container.clientHeight * .35) line = i;
          void update(current.number, line);
        }}>{current.lyrics.split("\n").map((line, index) => <span className="lyric-line" key={index}>{line || "\u00a0"}</span>)}</div></>}
      </>}
    </section>
    <section className="live-panel"><h2>Private library</h2>
      {songs.map((song) => <button type="button" key={song.id} onClick={() => setEdit(song)}>{song.number}. {song.title}</button>)}
      <h3>{edit.id ? "Edit song" : "Add song"}</h3>
      <input aria-label="Song number" type="number" min="1" value={edit.number ?? ""} onChange={(event) => setEdit({ ...edit, number: Number(event.target.value) })} placeholder="Number" />
      <input aria-label="Song title" value={edit.title ?? ""} onChange={(event) => setEdit({ ...edit, title: event.target.value })} placeholder="Title" />
      <input aria-label="Hindi title" value={edit.title_hindi ?? ""} onChange={(event) => setEdit({ ...edit, title_hindi: event.target.value })} placeholder="Hindi title" />
      <input aria-label="Film" value={edit.film ?? ""} onChange={(event) => setEdit({ ...edit, film: event.target.value })} placeholder="Film" />
      <input aria-label="Language" value={edit.language ?? ""} onChange={(event) => setEdit({ ...edit, language: event.target.value })} placeholder="Language" />
      <textarea aria-label="Lyrics" value={edit.lyrics ?? ""} onChange={(event) => setEdit({ ...edit, lyrics: event.target.value })} placeholder="Lyrics" rows={12} />
      <textarea aria-label="ChordPro" value={edit.chord_pro ?? ""} onChange={(event) => setEdit({ ...edit, chord_pro: event.target.value })} placeholder="Optional ChordPro" rows={6} />
      <button type="button" onClick={() => void saveSong()}>Save song</button>
    </section>
    <section className="live-panel"><h2>Playlists</h2>
      {playlists.map((playlist) => <p key={playlist.id}>{playlist.name} ({playlist.songs.length} songs) <button type="button" onClick={() => void start(playlist.id)}>Start live session</button></p>)}
      <input aria-label="New playlist name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Playlist name" />
      <p>Select songs in performance order:</p>
      {songs.map((song) => <button type="button" key={song.id} aria-pressed={selected.includes(song.id)} onClick={() => setSelected(selected.includes(song.id) ? selected.filter((id) => id !== song.id) : [...selected, song.id])}>{selected.includes(song.id) ? `${selected.indexOf(song.id) + 1}. ` : "+ "}{song.title}</button>)}
      <button type="button" onClick={() => void savePlaylist()}>Save playlist</button>
    </section>
  </div>;
}
