import songsData from "../../content/songs.json";

export type Song = {
  number: number;
  title: string;
  titleHindi: string;
  film: string;
  language: string;
  lyrics: string | null;
  chordPro?: string | null;
};

const songs = songsData as Song[];
const numbers = new Set<number>();
for (const song of songs) {
  if (!Number.isInteger(song.number) || song.number < 1 || numbers.has(song.number)) {
    throw new Error(`Invalid or duplicate song number: ${song.number}`);
  }
  if (!song.title.trim() || !song.language.trim() ||
      (song.lyrics !== null && !song.lyrics.trim()) ||
      (song.chordPro != null && !song.chordPro.trim())) {
    throw new Error(`Incomplete song ${song.number}`);
  }
  numbers.add(song.number);
}

export const publishedSongs = songs
  .filter((song) => song.lyrics !== null)
  .sort((a, b) => a.number - b.number);

export function getSong(number: number) {
  return publishedSongs.find((song) => song.number === number);
}
