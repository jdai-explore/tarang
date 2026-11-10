import { subscriberToken } from "@/lib/live";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const token = await subscriberToken((await params).code.toUpperCase());
    return token ? Response.json(token, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Session not found" }, { status: 404 });
  } catch {
    return Response.json({ error: "Live sessions are unavailable" }, { status: 503 });
  }
}
