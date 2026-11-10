import "server-only";
import { createHttpClient } from "@ably/pubsub-server";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
type Position = { line: number; fraction: number };

type SessionRow = { id: number; code: string; playlist_id: number; active_song_id: number | null; song_number: number | null; line: number; fraction: number; revision: number; leader_user_id: string; leader_epoch: number; expires_at: string };
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const bytes = randomBytes(10);
  return [...bytes].map((byte) => alphabet[byte & 31]).join("");
}
function channel(code: string) { return `tarang:session:${code}`; }
function ably() {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("ABLY_API_KEY is not configured");
  return createHttpClient({ key });
}
function state(row: SessionRow) {
  return { code: row.code, song: row.song_number, position: { line: row.line, fraction: row.fraction }, seq: Number(row.revision), expiresAt: row.expires_at };
}

export async function activeSession(code: string) {
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(code)) return null;
  const rows = await sql()`SELECT s.*, g.number AS song_number FROM tarang_sessions s
    LEFT JOIN tarang_songs g ON g.id = s.active_song_id
    WHERE s.code = ${code} AND s.status = 'live' AND s.expires_at > now() LIMIT 1` as SessionRow[];
  return rows[0] ?? null;
}

export async function startSession(playlistId: number, leaderId: string) {
  const existing = await sql()`SELECT code FROM tarang_sessions WHERE status = 'live' AND expires_at > now() LIMIT 1` as { code: string }[];
  if (existing.length) return { existing: existing[0].code };
  const songs = await sql()`SELECT g.id, g.number FROM tarang_playlist_songs p
    JOIN tarang_songs g ON g.id = p.song_id WHERE p.playlist_id = ${playlistId} ORDER BY p.position LIMIT 1` as { id: number; number: number }[];
  if (!songs.length) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const rows = await sql()`INSERT INTO tarang_sessions (code, playlist_id, active_song_id, leader_user_id, status, expires_at)
      VALUES (${code}, ${playlistId}, ${songs[0].id}, ${leaderId}, 'live', now() + interval '8 hours')
      ON CONFLICT (code) DO NOTHING RETURNING *` as SessionRow[];
    if (rows.length) {
      const result = { ...rows[0], song_number: songs[0].number };
      await ably().channels.get(channel(code)).publish("state", state(result));
      return { code, epoch: Number(result.leader_epoch), state: state(result) };
    }
  }
  throw new Error("Could not allocate a session code");
}

export async function takeOver(code: string, leaderId: string) {
  const rows = await sql()`UPDATE tarang_sessions SET leader_user_id = ${leaderId}, leader_epoch = leader_epoch + 1,
    revision = revision + 1 WHERE code = ${code} AND status = 'live' AND expires_at > now() RETURNING *` as SessionRow[];
  return rows.length ? { epoch: Number(rows[0].leader_epoch), code } : null;
}

export async function updatePrivateSession(code: string, leaderId: string, epoch: number, songNumber: number, position: Position) {
  if (!Number.isInteger(songNumber) || !Number.isInteger(position?.line) || position.line < 0 || position.line > 10000 ||
      !Number.isFinite(position?.fraction) || position.fraction < 0 || position.fraction > 1) return null;
  const rows = await sql()`UPDATE tarang_sessions s SET active_song_id = g.id, line = ${position.line},
    fraction = ${position.fraction}, revision = s.revision + 1
    FROM tarang_songs g WHERE s.code = ${code} AND s.status = 'live' AND s.expires_at > now()
    AND s.leader_user_id = ${leaderId} AND s.leader_epoch = ${epoch}
    AND g.number = ${songNumber} AND EXISTS (SELECT 1 FROM tarang_playlist_songs p
      WHERE p.playlist_id = s.playlist_id AND p.song_id = g.id)
    RETURNING s.*, g.number AS song_number` as SessionRow[];
  if (!rows.length) return null;
  const result = state(rows[0]);
  await ably().channels.get(channel(code)).publish("state", result);
  return result;
}

export async function scrollPrivateSession(code: string, leaderId: string, epoch: number, songNumber: number, position: Position) {
  if (!Number.isInteger(songNumber) || !Number.isInteger(position?.line) || position.line < 0 || position.line > 10000 ||
      !Number.isFinite(position?.fraction) || position.fraction < 0 || position.fraction > 1) return null;
  const rows = await sql()`UPDATE tarang_sessions s SET line = ${position.line}, fraction = ${position.fraction},
    revision = s.revision + 1 FROM tarang_songs g
    WHERE s.code = ${code} AND s.status = 'live' AND s.expires_at > now()
    AND s.leader_user_id = ${leaderId} AND s.leader_epoch = ${epoch}
    AND s.active_song_id = g.id AND g.number = ${songNumber}
    RETURNING s.*, g.number AS song_number` as SessionRow[];
  if (!rows.length) return null;
  const result = state(rows[0]);
  await ably().channels.get(channel(code)).publish("state", result);
  return result;
}

export async function endSession(code: string, leaderId: string, epoch: number) {
  const rows = await sql()`UPDATE tarang_sessions SET status = 'ended', leader_epoch = leader_epoch + 1
    WHERE code = ${code} AND status = 'live' AND leader_user_id = ${leaderId} AND leader_epoch = ${epoch} RETURNING code` as { code: string }[];
  if (!rows.length) return false;
  await ably().channels.get(channel(code)).publish("ended", { code });
  return true;
}

export async function currentSong(code: string) {
  const session = await activeSession(code);
  if (!session?.active_song_id) return null;
  const rows = await sql()`SELECT number, title, title_hindi, film, language, lyrics, chord_pro
    FROM tarang_songs WHERE id = ${session.active_song_id} LIMIT 1` as { number: number; title: string; title_hindi: string; film: string; language: string; lyrics: string; chord_pro: string | null }[];
  return rows[0] ?? null;
}

export async function subscriberTokenFor(code: string) {
  if (!await activeSession(code)) return null;
  return ably().auth.createTokenRequest({ capability: JSON.stringify({ [channel(code)]: ["subscribe"] }), ttl: 5 * 60 * 1000 });
}
