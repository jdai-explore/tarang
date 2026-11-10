import { currentLeader } from "@/lib/leaders";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const playlists = await sql()`SELECT p.id, p.name, COALESCE(json_agg(json_build_object('id', s.id, 'number', s.number, 'title', s.title)
    ORDER BY ps.position) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS songs
    FROM tarang_playlists p LEFT JOIN tarang_playlist_songs ps ON ps.playlist_id = p.id
    LEFT JOIN tarang_songs s ON s.id = ps.song_id GROUP BY p.id ORDER BY p.created_at DESC`;
  return Response.json(playlists, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.length > 100 ||
      !Array.isArray(body.songIds) || body.songIds.length > 200 ||
      !body.songIds.every((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0) ||
      new Set(body.songIds).size !== body.songIds.length)
    return Response.json({ error: "Invalid playlist" }, { status: 400 });
  const rows = await sql()`INSERT INTO tarang_playlists (name, created_by) VALUES (${body.name.trim()}, ${leader.id}) RETURNING id` as { id: number }[];
  const playlistId = rows[0].id;
  for (let i = 0; i < body.songIds.length; i++) {
    await sql()`INSERT INTO tarang_playlist_songs (playlist_id, song_id, position)
      VALUES (${playlistId}, ${body.songIds[i]}, ${i})`;
  }
  return Response.json({ id: playlistId }, { headers: { "Cache-Control": "no-store" } });
}
