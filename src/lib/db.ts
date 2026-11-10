import "server-only";
import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | undefined;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    client = neon(url);
  }
  return client;
}
