import { createSession } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    const session = await createSession();
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error as { name?: string; code?: number; statusCode?: number };
    console.error("Live session creation failed", { name: failure.name, code: failure.code, statusCode: failure.statusCode });
    return Response.json({ error: "Live sessions are unavailable" }, { status: 503 });
  }
}
