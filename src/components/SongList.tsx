"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Song } from "@/lib/songs";
import Preferences from "./Preferences";

export default function SongList({ songs }: { songs: Song[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return songs.filter((song) =>
      !value || String(song.number).includes(value) ||
      song.title.toLocaleLowerCase().includes(value) || song.titleHindi.includes(value)
    );
  }, [songs, query]);
  return (
    <main className="shell">
      <header className="masthead"><div className="brand">tarang<span className="brand-dot">.</span></div><Preferences /></header>
      <section className="hero">
        <p className="eyebrow">YOUR JAM SONGBOOK</p>
        <h1>Find your song.<br /><em>Sing your heart out.</em></h1>
        <p className="intro">Pick a song number or search by name. Your lyrics are just a tap away.</p>
      </section>
      <section className="catalog" aria-labelledby="catalog-title">
        <div className="section-head"><h2 id="catalog-title">Songs</h2><span>{songs.length} ready to sing</span></div>
        <label className="search-label" htmlFor="song-search">Search songs</label>
        <input id="song-search" className="search" type="search" inputMode="search" placeholder="Search number or song title" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="song-list">
          {filtered.map((song) => <Link className="song-card" href={`/songs/${song.number}/`} key={song.number}>
            <span className="card-number">{String(song.number).padStart(2, "0")}</span>
            <span className="card-text"><strong>{song.title}</strong><small lang="hi">{song.titleHindi}</small></span>
            <span className="arrow" aria-hidden="true">↗</span>
          </Link>)}
          {filtered.length === 0 && <p className="empty">No songs match “{query}”. Try a different number or title.</p>}
        </div>
      </section>
      <footer className="home-footer">Made for singing together.</footer>
    </main>
  );
}
