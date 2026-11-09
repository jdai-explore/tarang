import Redis from "ioredis";
import { randomBytes, createHash } from "node:crypto";
import { publishedSongs } from "./songs";

export type Position = { line: number; fraction: number };
export type LiveState = { code: string; song: number; position: Position; seq: number; updatedAt: number };

const ttlSeconds = 8 * 60 * 60;
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 2 }) : null;
const subscriber = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 2 }) : null;
const listeners = new Map<string, Set<(state: LiveState) => void>>();

subscriber?.on("message", (channel, payload) => {
  const code = channel.slice("tarang:events:".length);
  const state = JSON.parse(payload) as LiveState;
  listeners.get(code)?.forEach((listener) => listener(state));
});

function requireRedis() {
  if (!redis) throw new Error("REDIS_URL is not configured");
  return redis;
}

function key(code: string) { return `tarang:session:${code}`; }
function channel(code: string) { return `tarang:events:${code}`; }
function validCode(code: string) { return /^[A-F0-9]{6}$/.test(code); }
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function createSession() {
  const db = requireRedis();
  const token = randomBytes(32).toString("hex");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    const state: LiveState = { code, song: publishedSongs[0]?.number ?? 1, position: { line: 0, fraction: 0 }, seq: 0, updatedAt: Date.now() };
    const created = await db.set(key(code), JSON.stringify({ state, hash: tokenHash(token) }), "EX", ttlSeconds, "NX");
    if (created === "OK") return { code, token, state };
  }
  throw new Error("Could not allocate session code");
}

export async function getSession(code: string): Promise<LiveState | null> {
  if (!validCode(code)) return null;
  const value = await requireRedis().get(key(code));
  return value ? (JSON.parse(value) as { state: LiveState }).state : null;
}

const updateScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local session = cjson.decode(raw)
if session.hash ~= ARGV[1] then return 'DENIED' end
local state = cjson.decode(ARGV[2])
state.seq = session.state.seq + 1
session.state = state
local output = cjson.encode(session)
redis.call('SET', KEYS[1], output, 'EX', tonumber(ARGV[3]))
redis.call('PUBLISH', KEYS[2], cjson.encode(state))
return cjson.encode(state)
`;

export async function updateSession(code: string, token: string, song: number, position: Position) {
  if (!validCode(code) || !/^[a-f0-9]{64}$/.test(token)) return null;
  if (!publishedSongs.some((item) => item.number === song)) return null;
  if (!Number.isInteger(position.line) || position.line < 0 || position.line > 10000 ||
      !Number.isFinite(position.fraction) || position.fraction < 0 || position.fraction > 1) return null;
  const state: LiveState = { code, song, position, seq: 0, updatedAt: Date.now() };
  const result = await requireRedis().eval(updateScript, 2, key(code), channel(code), tokenHash(token), JSON.stringify(state), String(ttlSeconds));
  if (!result || result === "DENIED") return null;
  return JSON.parse(result as string) as LiveState;
}

export async function subscribe(code: string, listener: (state: LiveState) => void) {
  if (!validCode(code) || !subscriber) throw new Error("Invalid session");
  let set = listeners.get(code);
  if (!set) {
    set = new Set();
    listeners.set(code, set);
    await subscriber.subscribe(channel(code));
  }
  set.add(listener);
  return async () => {
    set?.delete(listener);
    if (set?.size === 0) {
      listeners.delete(code);
      await subscriber.unsubscribe(channel(code));
    }
  };
}
