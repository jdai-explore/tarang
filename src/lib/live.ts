import { createHttpClient } from "@ably/pubsub-server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { publishedSongs } from "./songs";

export type Position = { line: number; fraction: number };
export type LiveState = { code: string; song: number; position: Position; seq: number; updatedAt: number; expiresAt: number };

const sessionMs = 8 * 60 * 60 * 1000;
let rest: ReturnType<typeof createHttpClient> | null = null;

function ably() {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("ABLY_API_KEY is not configured");
  return rest ?? (rest = createHttpClient({ key }));
}

function channel(code: string) { return `tarang:session:${code}`; }
function validCode(code: string) { return /^[A-F0-9]{6}$/.test(code); }

function sign(code: string, expiresAt: number, nonce: string) {
  return createHmac("sha256", process.env.ABLY_API_KEY!)
    .update(`${code}:${expiresAt}:${nonce}`).digest("hex");
}

function leaderToken(code: string, expiresAt: number) {
  const nonce = randomBytes(16).toString("hex");
  return `${expiresAt}.${nonce}.${sign(code, expiresAt, nonce)}`;
}

function validLeaderToken(code: string, token: string) {
  const match = /^(\d{13})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) <= Date.now()) return false;
  const expected = Buffer.from(sign(code, Number(match[1]), match[2]), "hex");
  return timingSafeEqual(expected, Buffer.from(match[3], "hex"));
}

export async function getSession(code: string): Promise<LiveState | null> {
  if (!validCode(code)) return null;
  const history = await ably().channels.get(channel(code)).history({ limit: 1 });
  const state = history.items[0]?.data as LiveState | undefined;
  if (!state || state.code !== code || state.expiresAt <= Date.now()) return null;
  return state;
}

export async function createSession() {
  const client = ably();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    if (await getSession(code)) continue;
    const now = Date.now();
    const state: LiveState = { code, song: publishedSongs[0]?.number ?? 1, position: { line: 0, fraction: 0 }, seq: 0, updatedAt: now, expiresAt: now + sessionMs };
    await client.channels.get(channel(code)).publish("state", state);
    return { code, token: leaderToken(code, state.expiresAt), state };
  }
  throw new Error("Could not allocate session code");
}

export async function updateSession(code: string, token: string, song: number, position: Position) {
  if (!validCode(code) || typeof token !== "string" || !validLeaderToken(code, token)) return null;
  if (!publishedSongs.some((item) => item.number === song)) return null;
  if (!position || !Number.isInteger(position.line) || position.line < 0 || position.line > 10000 ||
      !Number.isFinite(position.fraction) || position.fraction < 0 || position.fraction > 1) return null;
  const expiresAt = Number(token.slice(0, 13));
  const now = Date.now();
  const state: LiveState = { code, song, position, seq: now, updatedAt: now, expiresAt };
  await ably().channels.get(channel(code)).publish("state", state);
  return state;
}

export async function subscriberToken(code: string) {
  if (!await getSession(code)) return null;
  return ably().auth.createTokenRequest({
    capability: JSON.stringify({ [channel(code)]: ["subscribe"] }),
    ttl: 60 * 60 * 1000,
  });
}
