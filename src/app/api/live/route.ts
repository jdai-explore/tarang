import { createSession } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    const session = await createSession();
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error as { name?: string; code?: number; statusCode?: number; message?: string };
    const key = process.env.ABLY_API_KEY;
    const message = key ? failure.message?.replaceAll(key, "[redacted]") : failure.message;
    console.error("Live session creation failed", { name: failure.name, code: failure.code, statusCode: failure.statusCode, message });
    return Response.json({ error: "Live sessions are unavailable" }, { status: 503 });
  }
}
