import { subscriberTokenFor } from "@/lib/private-live";
import { invalidLookupStatus } from "@/lib/lookup-limit";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const token = await subscriberTokenFor((await params).code.toUpperCase());
  return token ? Response.json(token, { headers: { "Cache-Control": "private, no-store" } })
    : Response.json({ error: "Session not found" }, { status: await invalidLookupStatus(request) });
}
