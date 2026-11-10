import "server-only";
import { getAuth } from "./auth";
import { sql } from "./db";

export async function currentLeader() {
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user?.id || !user.email || !user.emailVerified) return null;
  const owner = process.env.TARANG_OWNER_EMAIL?.trim().toLowerCase();
  if (owner && user.email.toLowerCase() === owner) return { id: user.id, email: user.email, owner: true };
  const email = user.email.toLowerCase();
  await sql()`UPDATE tarang_leaders SET user_id = ${user.id} WHERE email = ${email} AND user_id IS NULL AND revoked_at IS NULL`;
  const rows = await sql()`SELECT user_id FROM tarang_leaders WHERE user_id = ${user.id} AND email = ${email} AND revoked_at IS NULL LIMIT 1` as { user_id: string }[];
  return rows.length ? { id: user.id, email: user.email, owner: false } : null;
}
