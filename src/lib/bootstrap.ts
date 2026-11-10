import "server-only";
import { sql } from "./db";
import songs from "../../content/songs.json";
type Song = { number: number; title: string; titleHindi: string; film: string; language: string; lyrics: string | null; chordPro?: string | null };

const statements = [
  `CREATE TABLE IF NOT EXISTS tarang_leaders (email text PRIMARY KEY, user_id text UNIQUE, approved_by text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS tarang_songs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, number integer NOT NULL UNIQUE CHECK (number > 0), title text NOT NULL, title_hindi text NOT NULL DEFAULT '', film text NOT NULL DEFAULT '', language text NOT NULL, lyrics text NOT NULL, chord_pro text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS tarang_playlists (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS tarang_playlist_songs (playlist_id bigint NOT NULL REFERENCES tarang_playlists(id) ON DELETE CASCADE, song_id bigint NOT NULL REFERENCES tarang_songs(id) ON DELETE CASCADE, position integer NOT NULL CHECK (position >= 0), PRIMARY KEY (playlist_id, song_id), UNIQUE (playlist_id, position))`,
  `CREATE TABLE IF NOT EXISTS tarang_sessions (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code text NOT NULL UNIQUE, playlist_id bigint NOT NULL REFERENCES tarang_playlists(id), active_song_id bigint REFERENCES tarang_songs(id), line integer NOT NULL DEFAULT 0, fraction double precision NOT NULL DEFAULT 0, revision bigint NOT NULL DEFAULT 0, leader_user_id text NOT NULL, leader_epoch bigint NOT NULL DEFAULT 1, status text NOT NULL CHECK (status IN ('live', 'ended')), created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tarang_invalid_lookups (bucket text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`,
];

export async function bootstrapPrivateData(ownerId: string) {
  for (const statement of statements) await sql().query(statement);
  for (const song of songs as Song[]) {
    if (song.lyrics) await sql()`INSERT INTO tarang_songs (number, title, title_hindi, film, language, lyrics, chord_pro)
      VALUES (${song.number}, ${song.title}, ${song.titleHindi}, ${song.film}, ${song.language}, ${song.lyrics}, ${song.chordPro ?? null})
      ON CONFLICT (number) DO NOTHING`;
  }
  const existing = await sql()`SELECT id FROM tarang_playlists WHERE name = 'Starter set' AND created_by = ${ownerId} LIMIT 1` as { id: number }[];
  let playlistId = existing[0]?.id;
  if (!playlistId) {
    const created = await sql()`INSERT INTO tarang_playlists (name, created_by) VALUES ('Starter set', ${ownerId}) RETURNING id` as { id: number }[];
    playlistId = created[0].id;
  }
  const rows = await sql()`SELECT id FROM tarang_songs ORDER BY number` as { id: number }[];
  for (let position = 0; position < rows.length; position++) {
    await sql()`INSERT INTO tarang_playlist_songs (playlist_id, song_id, position)
      VALUES (${playlistId}, ${rows[position].id}, ${position}) ON CONFLICT DO NOTHING`;
  }
  return { songs: rows.length, playlistId };
}
