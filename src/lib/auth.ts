import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

let instance: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret || secret.length < 32) throw new Error("Neon Auth is not configured");
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}
