import { currentLeader } from "@/lib/leaders";
import { startSession } from "@/lib/private-live";

export const runtime = "nodejs";

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
