import { currentLeader } from "@/lib/leaders";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const leader = await currentLeader();
  if (!leader?.owner) return Response.json({ error: "Forbidden" }, { status: 403 });
  const rows = await sql()`SELECT email, user_id, approved_at, revoked_at FROM tarang_leaders ORDER BY approved_at DESC`;
  return Response.json(rows, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const leader = await currentLeader();
  if (!leader?.owner) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@gmail\.com$/.test(email) || email.length > 254) return Response.json({ error: "Enter a Gmail address" }, { status: 400 });
  if (email === leader.email.toLowerCase()) return Response.json({ error: "Owner is already approved" }, { status: 400 });
  if (body.action === "approve") {
    await sql()`INSERT INTO tarang_leaders (email, approved_by) VALUES (${email}, ${leader.id})
      ON CONFLICT (email) DO UPDATE SET revoked_at = NULL, approved_by = ${leader.id}, approved_at = now()`;
    return Response.json({ approved: true });
  }
  if (body.action === "revoke") {
    const rows = await sql()`UPDATE tarang_leaders SET revoked_at = now() WHERE email = ${email} AND revoked_at IS NULL RETURNING user_id` as { user_id: string | null }[];
    if (rows[0]?.user_id) await sql()`UPDATE tarang_sessions SET leader_epoch = leader_epoch + 1, leader_user_id = ${leader.id}
      WHERE leader_user_id = ${rows[0].user_id} AND status = 'live'`;
    return Response.json({ revoked: true });
  }
  return Response.json({ error: "Invalid action" }, { status: 400 });
}
