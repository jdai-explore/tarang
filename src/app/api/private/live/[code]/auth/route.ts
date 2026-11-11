import { subscriberTokenFor } from "@/lib/private-live";
import { invalidLookupStatus } from "@/lib/lookup-limit";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const saved = (await cookies()).get("tarang_follower_id")?.value;
  const followerId = saved && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(saved) ? saved : randomUUID();
  const token = await subscriberTokenFor((await params).code.toUpperCase(), followerId);
  if (!token) return Response.json({ error: "Session not found" }, { status: await invalidLookupStatus(request) });
  const response = NextResponse.json(token, { headers: { "Cache-Control": "private, no-store" } });
  if (!saved || saved !== followerId) response.cookies.set("tarang_follower_id", followerId, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/private/live", maxAge: 8 * 60 * 60,
  });
  return response;
}
