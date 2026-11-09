import { notFound } from "next/navigation";
import Link from "next/link";
import { getSong, publishedSongs } from "@/lib/songs";
import Preferences from "@/components/Preferences";
import LiveControls from "@/components/LiveControls";

export function generateStaticParams() {
  return publishedSongs.map((song) => ({ number: String(song.number) }));
}

export default async function SongPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const song = getSong(Number(number));
  if (!song) notFound();
  return (
    <main className="shell reader">
      <header className="reader-top">
        <Link href="/" className="back">← Song list</Link>
        <Preferences showSize />
      </header>
      <div className="song-heading">
        <div className="song-number">Song {String(song.number).padStart(2, "0")}</div>
        <h1>{song.title}</h1>
        <p className="hindi" lang="hi">{song.titleHindi}</p>
        <p className="muted">{song.film} · Hindi (Roman script)</p>
      </div>
      <LiveControls song={song.number} lyrics={song.lyrics ?? undefined} chordPro={song.chordPro} />
      <footer><Link href="/" className="back">← Back to all songs</Link></footer>
    </main>
  );
}
