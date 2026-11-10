"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Song = { id: number; number: number; title: string; title_hindi: string; film: string; language: string; lyrics: string; chord_pro: string | null };
type Playlist = { id: number; name: string; songs: { id: number; number: number; title: string }[] };
type Session = { code: string; playlist_id: number; leader_user_id: string; leader_epoch: number; song_number: number | null };
type Grant = { email: string; revoked_at: string | null };
type View = "live" | "library" | "leaders";

export default function LeaderWorkspace({ owner, userId, signedInEmail }: { owner: boolean; userId: string; signedInEmail: string }) {
  const [view, setView] = useState<View>("live");
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [active, setActive] = useState<{ code: string; epoch: number; song: number | null } | null>(null);
  const [edit, setEdit] = useState<Partial<Song>>({ language: "hi-Latn" });
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const lastSent = useRef(0);
  const controlAt = useRef(0);
  const [snapshotAt, setSnapshotAt] = useState(0);

  const load = useCallback(async () => {
    const requestedAt = performance.now();
    try {
      const [songsResponse, playlistsResponse, sessionsResponse] = await Promise.all([
        fetch("/api/private/library/", { cache: "no-store" }),
        fetch("/api/private/playlists/", { cache: "no-store" }),
        fetch("/api/private/live/", { cache: "no-store" }),
      ]);
      if (!songsResponse.ok || !playlistsResponse.ok || !sessionsResponse.ok) throw new Error("Could not load the private workspace.");
      const [nextSongs, nextPlaylists, nextSessions] = await Promise.all([songsResponse.json(), playlistsResponse.json(), sessionsResponse.json()]);
      setSongs(nextSongs); setPlaylists(nextPlaylists); setSessions(nextSessions); setSnapshotAt(requestedAt);
      if (owner) {
        const response = await fetch("/api/admin/leaders/", { cache: "no-store" });
        if (response.ok) setGrants(await response.json());
      }
    } catch (error) { setNotice({ text: (error as Error).message, error: true }); }
    finally { setLoading(false); }
  }, [owner]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    if (!active || snapshotAt <= controlAt.current) return;
    const session = sessions.find((item) => item.code === active.code);
    if (!session || session.leader_user_id !== userId || session.leader_epoch !== active.epoch) {
      setActive(null);
      setNotice({ text: "Control moved to another leader, or the session ended.", error: true });
    }
  }, [active, sessions, snapshotAt, userId]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error ?? "Request failed"), { status: response.status });
    return result;
  }
  async function act(key: string, task: () => Promise<string>) {
    if (busy) return;
    setBusy(key); setNotice(null);
    try { setNotice({ text: await task() }); }
    catch (error) { setNotice({ text: (error as Error).message, error: true }); }
    finally { setBusy(""); }
  }
  function show(next: View) { setView(next); setNotice(null); }

  async function start(playlistId: number) {
    await act("start", async () => {
      const result = await post("/api/private/live/", { playlistId });
      controlAt.current = performance.now();
      setActive({ code: result.code, epoch: result.epoch, song: result.state.song });
      show("live"); await load();
      return `Session ${result.code} is live. Share this code with followers.`;
    });
  }
  async function takeover(session: Session) {
    await act("takeover", async () => {
      const result = await post(`/api/private/live/${session.code}/`, { action: "takeover" });
      controlAt.current = performance.now();
      setActive({ code: session.code, epoch: result.epoch, song: session.song_number });
      await load(); return "You have control. Confirm the current song before scrolling.";
    });
  }
  async function selectSong(songNumber: number) {
    if (!active) return;
    await act("select", async () => {
      await post(`/api/private/live/${active.code}/`, { action: "select", epoch: active.epoch, song: songNumber, position: { line: 0, fraction: .35 } });
      setActive({ ...active, song: songNumber });
      return `Song ${songNumber} is now visible to followers.`;
    });
  }
  async function scroll(songNumber: number, line: number) {
    if (!active) return;
    try { await post(`/api/private/live/${active.code}/`, { action: "scroll", epoch: active.epoch, song: songNumber, position: { line, fraction: .35 } }); }
    catch (error) { if ((error as Error & { status?: number }).status !== 409) setNotice({ text: `Scroll sync failed: ${(error as Error).message}`, error: true }); }
  }
  async function end() {
    if (!active || !window.confirm(`End session ${active.code}? Followers will lose access to the live song.`)) return;
    await act("end", async () => {
      await post(`/api/private/live/${active.code}/`, { action: "end", epoch: active.epoch });
      setActive(null); await load(); return "Session ended. Followers can no longer fetch its lyrics.";
    });
  }
  async function saveSong() {
    await act("song", async () => {
      await post("/api/private/library/", { id: edit.id, number: Number(edit.number), title: edit.title, titleHindi: edit.title_hindi, film: edit.film, language: edit.language, lyrics: edit.lyrics, chordPro: edit.chord_pro });
      setEdit({ language: "hi-Latn" }); await load(); return "Song saved to your private library.";
    });
  }
  async function savePlaylist() {
    await act("playlist", async () => {
      await post("/api/private/playlists/", { name, songIds: selected });
      setName(""); setSelected([]); await load(); return "Setlist saved privately.";
    });
  }
  async function grant(action: "approve" | "revoke", address: string) {
    await act("grant", async () => {
      await post("/api/admin/leaders/", { action, email: address });
      setEmail(""); await load(); return action === "approve" ? "Leader approved." : "Leader access revoked.";
    });
  }

  const current = songs.find((song) => song.number === active?.song);
  const playlist = playlists.find((item) => item.id === sessions.find((session) => session.code === active?.code)?.playlist_id);
  const hasSession = sessions.length > 0;

  return <div className="leader-workspace">
    <header className="leader-header"><div><span className="leader-kicker">Tarang · leader studio</span><h1>Run the room.</h1><p>{signedInEmail} · {owner ? "owner" : "leader"}</p></div><button type="button" className="leader-signout" onClick={() => void authClient.signOut().then(() => location.reload())}>Sign out</button></header>
    <nav className="leader-nav" aria-label="Leader workspace">
      <button type="button" aria-current={view === "live" ? "page" : undefined} onClick={() => show("live")}>Live</button>
      <button type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => show("library")}>Setlists & songs</button>
      {owner && <button type="button" aria-current={view === "leaders" ? "page" : undefined} onClick={() => show("leaders")}>Leaders</button>}
    </nav>
    <p className="leader-notice" role={notice?.error ? "alert" : "status"} data-error={notice?.error || undefined}>{notice?.text || (loading ? "Loading your private workspace…" : "")}</p>

    {view === "live" && <div className="leader-view"><div className="leader-view-heading"><div><span className="leader-kicker">Performance</span><h2>Live control</h2></div><span className={hasSession ? "leader-pill is-live" : "leader-pill"}>{hasSession ? "● Session live" : "○ Off air"}</span></div>
      {loading ? <section className="leader-card"><p>Loading sessions…</p></section> : !hasSession ? <section className="leader-card leader-empty"><h3>Ready when you are.</h3><p>Prepare a setlist, then start it here. Followers see nothing until you go live.</p>{playlists.length ? playlists.map((item) => <div className="leader-row" key={item.id}><div><strong>{item.name}</strong><small>{item.songs.length} songs</small></div><button type="button" className="leader-primary" disabled={!!busy || !item.songs.length} onClick={() => void start(item.id)}>{busy === "start" ? "Starting…" : "Start session"}</button></div>) : <button type="button" className="leader-primary" onClick={() => show("library")}>Create a setlist</button>}</section> : <>
        <section className="leader-card"><div className="leader-card-heading"><div><span className="leader-kicker">Join code</span><strong className="leader-code">{active?.code || sessions[0].code}</strong></div><span className="leader-pill">{active ? "You are in control" : "Awaiting leader"}</span></div><p className="leader-hint">Share the code with followers. Only the selected song is released.</p>
          {!active && sessions.map((session) => <div className="leader-row" key={session.code}><div><strong>{session.code}</strong><small>Song {session.song_number ?? "—"} · {session.leader_user_id === userId ? "your account" : "another leader"}</small></div><button type="button" className="leader-primary" disabled={!!busy} onClick={() => void takeover(session)}>{busy === "takeover" ? "Taking control…" : session.leader_user_id === userId ? "Resume leading" : "Take over"}</button></div>)}
          {active && <button type="button" className="leader-danger" disabled={!!busy} onClick={() => void end()}>{busy === "end" ? "Ending…" : "End session"}</button>}
        </section>
        {active && <><section className="leader-card"><div className="leader-card-heading"><div><span className="leader-kicker">Broadcast</span><h3>Choose the song</h3></div><span className="leader-pill">{playlist?.name ?? "Setlist"}</span></div><div className="leader-song-grid">{playlist?.songs.map((song) => <button type="button" className="leader-song-choice" aria-pressed={active.song === song.number} key={song.id} disabled={!!busy} onClick={() => void selectSong(song.number)}><span>{String(song.number).padStart(2, "0")}</span><strong>{song.title}</strong></button>)}</div></section>
          <section className="leader-card"><div className="leader-card-heading"><div><span className="leader-kicker">Scroll sync</span><h3>{current?.title ?? "Select a song"}</h3></div><span className="leader-pill">{current ? `Song ${current.number}` : "No song"}</span></div><p className="leader-hint">Scroll the lyrics below to move followers with you.</p>{current && <div className="leader-lyrics lyric-lines" onScroll={(event) => { if (Date.now() - lastSent.current < 1200) return; lastSent.current = Date.now(); const container = event.currentTarget; const nodes = [...container.querySelectorAll(".lyric-line")]; let line = 0; for (let i = 0; i < nodes.length; i++) if (nodes[i].getBoundingClientRect().top <= container.getBoundingClientRect().top + container.clientHeight * .35) line = i; void scroll(current.number, line); }}>{current.lyrics.split("\n").map((line, index) => <span className="lyric-line" key={index}>{line || "\u00a0"}</span>)}</div>}</section></>}
      </>}
    </div>}

    {view === "library" && <div className="leader-view"><div className="leader-view-heading"><div><span className="leader-kicker">Private preparation</span><h2>Setlists & songs</h2></div></div><p className="leader-intro">Practice and organize here. Nothing on this page is visible to followers.</p>
      <section className="leader-card"><div className="leader-card-heading"><div><span className="leader-kicker">01 · Arrange</span><h3>Setlists</h3></div><span className="leader-pill">{playlists.length} saved</span></div>{playlists.map((item) => <div className="leader-row" key={item.id}><div><strong>{item.name}</strong><small>{item.songs.map((song) => song.number).join(" · ") || "No songs"}</small></div>{!hasSession && <button type="button" disabled={!!busy || !item.songs.length} onClick={() => void start(item.id)}>Start live</button>}</div>)}
        <div className="leader-form"><label htmlFor="setlist-name">New setlist name</label><input id="setlist-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Friday jam" /><p className="leader-hint">Tap songs in performance order. Tap again to remove.</p><div className="leader-song-grid">{songs.map((song) => <button type="button" className="leader-song-choice" key={song.id} aria-pressed={selected.includes(song.id)} onClick={() => setSelected(selected.includes(song.id) ? selected.filter((id) => id !== song.id) : [...selected, song.id])}><span>{selected.includes(song.id) ? selected.indexOf(song.id) + 1 : "+"}</span><strong>{song.title}</strong></button>)}</div><button type="button" className="leader-primary" disabled={!!busy || !name.trim() || !selected.length} onClick={() => void savePlaylist()}>{busy === "playlist" ? "Saving…" : "Save setlist"}</button></div>
      </section>
      <section className="leader-card"><div className="leader-card-heading"><div><span className="leader-kicker">02 · Write</span><h3>Private songs</h3></div><span className="leader-pill">{songs.length} saved</span></div>{songs.map((song) => <button type="button" className="leader-library-song" key={song.id} onClick={() => setEdit(song)}><span>{String(song.number).padStart(2, "0")}</span><strong>{song.title}</strong><small>Edit →</small></button>)}
        <div className="leader-form"><div className="leader-card-heading"><h4>{edit.id ? `Edit ${edit.title}` : "Add a song"}</h4>{edit.id && <button type="button" onClick={() => setEdit({ language: "hi-Latn" })}>New song</button>}</div>
          <label htmlFor="song-number">Song number</label><input id="song-number" type="number" min="1" value={edit.number ?? ""} onChange={(event) => setEdit({ ...edit, number: Number(event.target.value) })} />
          <label htmlFor="song-title">Title</label><input id="song-title" value={edit.title ?? ""} onChange={(event) => setEdit({ ...edit, title: event.target.value })} />
          <label htmlFor="song-hindi">Hindi title</label><input id="song-hindi" value={edit.title_hindi ?? ""} onChange={(event) => setEdit({ ...edit, title_hindi: event.target.value })} />
          <label htmlFor="song-film">Film</label><input id="song-film" value={edit.film ?? ""} onChange={(event) => setEdit({ ...edit, film: event.target.value })} />
          <label htmlFor="song-language">Language tag</label><input id="song-language" value={edit.language ?? ""} onChange={(event) => setEdit({ ...edit, language: event.target.value })} />
          <label htmlFor="song-lyrics">Lyrics</label><textarea id="song-lyrics" value={edit.lyrics ?? ""} onChange={(event) => setEdit({ ...edit, lyrics: event.target.value })} rows={12} />
          <label htmlFor="song-chordpro">ChordPro (optional)</label><textarea id="song-chordpro" value={edit.chord_pro ?? ""} onChange={(event) => setEdit({ ...edit, chord_pro: event.target.value })} rows={6} />
          <button type="button" className="leader-primary" disabled={!!busy || !edit.number || !edit.title?.trim() || !edit.lyrics?.trim()} onClick={() => void saveSong()}>{busy === "song" ? "Saving…" : "Save song privately"}</button>
        </div>
      </section>
    </div>}

    {view === "leaders" && owner && <div className="leader-view"><div className="leader-view-heading"><div><span className="leader-kicker">Owner only</span><h2>Leader access</h2></div></div><p className="leader-intro">Only approved Google accounts can open this workspace or control a session.</p><section className="leader-card"><h3>Approve a leader</h3><div className="leader-form"><label htmlFor="leader-email">Gmail address</label><input id="leader-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="leader@gmail.com" /><button type="button" className="leader-primary" disabled={!!busy || !email.trim()} onClick={() => void grant("approve", email)}>{busy === "grant" ? "Saving…" : "Approve leader"}</button></div></section><section className="leader-card"><div className="leader-card-heading"><h3>Approved accounts</h3><span className="leader-pill">{grants.filter((item) => !item.revoked_at).length} active</span></div>{grants.length === 0 && <p className="leader-hint">No additional leaders yet.</p>}{grants.map((item) => <div className="leader-row" key={item.email}><div><strong>{item.email}</strong><small>{item.revoked_at ? "Revoked" : "Approved"}</small></div>{!item.revoked_at && <button type="button" className="leader-danger" disabled={!!busy} onClick={() => { if (window.confirm(`Revoke ${item.email}?`)) void grant("revoke", item.email); }}>Revoke</button>}</div>)}</section></div>}
  </div>;
}
