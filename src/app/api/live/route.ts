import { createSession } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    const session = await createSession();
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Live sessions are unavailable" }, { status: 503 });
  }
}
