import { currentLeader } from "@/lib/leaders";
import { activeSession, endSession, takeOver, updatePrivateSession } from "@/lib/private-live";
import { invalidLookupStatus } from "@/lib/lookup-limit";

export const runtime = "nodejs";

type Context = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: Context) {
  const session = await activeSession((await context.params).code.toUpperCase());
  if (!session) return Response.json({ error: "Session not found" }, { status: await invalidLookupStatus(request) });
  return Response.json({ code: session.code, song: session.song_number, position: { line: session.line, fraction: session.fraction }, seq: Number(session.revision) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader) return Response.json({ error: "Forbidden" }, { status: 403 });
  const code = (await context.params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  if (body?.action === "takeover") {
    const result = await takeOver(code, leader.id);
    return result ? Response.json(result, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (!Number.isSafeInteger(body?.epoch) || body.epoch < 1) return Response.json({ error: "Invalid leader epoch" }, { status: 400 });
  if (body.action === "end") {
    const ended = await endSession(code, leader.id, body.epoch);
    return ended ? Response.json({ ended: true }) : Response.json({ error: "Not active leader" }, { status: 409 });
  }
  if (body.action === "update") {
    const result = await updatePrivateSession(code, leader.id, body.epoch, body.song, body.position);
    return result ? Response.json(result) : Response.json({ error: "Not active leader or invalid song" }, { status: 409 });
  }
  return Response.json({ error: "Invalid action" }, { status: 400 });
}
