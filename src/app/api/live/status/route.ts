export const runtime = "nodejs";

export async function GET() {
  return Response.json({ available: Boolean(process.env.ABLY_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
