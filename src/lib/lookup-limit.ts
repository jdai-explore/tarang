import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "./db";

export async function invalidLookupStatus(request: Request) {
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret) throw new Error("Rate-limit secret missing");
  const minute = Math.floor(Date.now() / 60000);
  const bucket = createHmac("sha256", secret).update(`${ip}:${minute}`).digest("hex");
  const rows = await sql()`INSERT INTO tarang_invalid_lookups (bucket, attempts) VALUES (${bucket}, 1)
    ON CONFLICT (bucket) DO UPDATE SET attempts = tarang_invalid_lookups.attempts + 1 RETURNING attempts` as { attempts: number }[];
  if (rows[0].attempts === 1) await sql()`DELETE FROM tarang_invalid_lookups WHERE created_at < now() - interval '1 day'`;
  return rows[0].attempts > 30 ? 429 : 404;
}
