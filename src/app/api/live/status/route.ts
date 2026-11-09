export const runtime = "nodejs";

export async function GET() {
  return Response.json({ available: Boolean(process.env.REDIS_URL) }, { headers: { "Cache-Control": "no-store" } });
}
