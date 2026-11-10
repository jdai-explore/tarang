import { currentLeader } from "@/lib/leaders";
import { bootstrapPrivateData } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader?.owner) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    return Response.json(await bootstrapPrivateData(leader.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Database setup failed" }, { status: 503 });
  }
}
