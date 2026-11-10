import { currentLeader } from "@/lib/leaders";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const playlists = await sql()`SELECT p.id, p.name, COALESCE(json_agg(json_build_object('id', s.id, 'number', s.number, 'title', s.title)
    ORDER BY ps.position) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS songs
    FROM tarang_playlists p LEFT JOIN tarang_playlist_songs ps ON ps.playlist_id = p.id
    LEFT JOIN tarang_songs s ON s.id = ps.song_id GROUP BY p.id ORDER BY p.created_at DESC`;
  return Response.json((playlists as { id: string; songs: { id: string; number: number; title: string }[]; name: string }[])
    .map((playlist) => ({ ...playlist, id: Number(playlist.id), songs: playlist.songs.map((song) => ({ ...song, id: Number(song.id) })) })),
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.length > 100 ||
      !Array.isArray(body.songIds) || body.songIds.length < 1 || body.songIds.length > 200 ||
      !body.songIds.every((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0) ||
      new Set(body.songIds).size !== body.songIds.length)
    return Response.json({ error: "Invalid playlist" }, { status: 400 });
  for (const id of body.songIds as number[]) {
    const found = await sql()`SELECT id FROM tarang_songs WHERE id = ${id} LIMIT 1` as { id: number }[];
    if (!found.length) return Response.json({ error: "Playlist contains an unavailable song" }, { status: 400 });
  }
  const rows = await sql()`INSERT INTO tarang_playlists (name, created_by) VALUES (${body.name.trim()}, ${leader.id}) RETURNING id` as { id: number }[];
  const playlistId = rows[0].id;
  try {
    for (let i = 0; i < body.songIds.length; i++) {
      await sql()`INSERT INTO tarang_playlist_songs (playlist_id, song_id, position)
        VALUES (${playlistId}, ${body.songIds[i]}, ${i})`;
    }
    return Response.json({ id: Number(playlistId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await sql()`DELETE FROM tarang_playlists WHERE id = ${playlistId} AND created_by = ${leader.id}`;
    return Response.json({ error: "Could not save playlist" }, { status: 409 });
  }
}
