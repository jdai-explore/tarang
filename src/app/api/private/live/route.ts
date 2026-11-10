import { currentLeader } from "@/lib/leaders";
import { startSession } from "@/lib/private-live";

export const runtime = "nodejs";

export async function GET() {
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { sql } = await import("@/lib/db");
  const rows = await sql()`SELECT s.code, s.playlist_id, s.leader_user_id, s.leader_epoch, s.revision,
    s.line, s.fraction, g.number AS song_number FROM tarang_sessions s
    LEFT JOIN tarang_songs g ON g.id = s.active_song_id
    WHERE s.status = 'live' AND s.expires_at > now() ORDER BY s.created_at DESC`;
  return Response.json((rows as { code: string; playlist_id: string; leader_user_id: string; leader_epoch: string; revision: string; line: number; fraction: number; song_number: number | null }[])
    .map((row) => ({ ...row, playlist_id: Number(row.playlist_id), leader_epoch: Number(row.leader_epoch), revision: Number(row.revision) })),
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const playlistId = body?.playlistId;
  if (!Number.isSafeInteger(playlistId) || playlistId < 1) return Response.json({ error: "Invalid playlist" }, { status: 400 });
  const result = await startSession(playlistId, leader.id);
  return result ? Response.json(result, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Playlist is empty" }, { status: 400 });
}
