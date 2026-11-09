import Redis from "ioredis";

const base = process.env.TARANG_BASE_URL || "http://localhost:3000";
const clients = Number(process.env.TARANG_CLIENTS || 500);
const updates = Number(process.env.TARANG_UPDATES || 120);
const created = await fetch(`${base}/api/live/`, { method: "POST" }).then((response) => response.json());
if (!created.code || !created.token) throw new Error("Could not create test session");
const subscriber = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
const counts = Array(clients).fill(0);
const delays = [];
subscriber.on("message", (_channel, payload) => {
  const state = JSON.parse(payload);
  for (let index = 0; index < clients; index++) {
    counts[index]++;
    delays.push(Date.now() - state.updatedAt);
  }
});
await subscriber.subscribe(`tarang:events:${created.code}`);
const started = Date.now();
for (let index = 0; index < updates; index++) {
  const response = await fetch(`${base}/api/live/${created.code}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: created.token, song: 1, position: { line: index, fraction: .35 } }),
  });
  if (!response.ok) throw new Error(`Update ${index} failed: ${response.status}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await new Promise((resolve) => setTimeout(resolve, 500));
delays.sort((a, b) => a - b);
const latest = await fetch(`${base}/api/live/${created.code}/`).then((response) => response.json());
console.log(JSON.stringify({ clients, updates, durationMs: Date.now() - started,
  minReceived: Math.min(...counts), maxReceived: Math.max(...counts), latestSeq: latest.seq,
  p50Ms: delays[Math.floor(delays.length * .5)], p95Ms: delays[Math.floor(delays.length * .95)] }, null, 2));
await subscriber.quit();
