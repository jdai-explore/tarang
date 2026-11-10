import { subscriberTokenFor } from "@/lib/private-live";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const token = await subscriberTokenFor((await params).code.toUpperCase());
  return token ? Response.json(token, { headers: { "Cache-Control": "private, no-store" } })
    : Response.json({ error: "Session not found" }, { status: 404 });
}
