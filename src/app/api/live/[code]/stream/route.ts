import { experimental_upgradeWebSocket } from "@vercel/functions";
import { getSession, subscribe } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const state = await getSession(code);
  if (!state) return new Response("Session not found", { status: 404 });
  return experimental_upgradeWebSocket((socket) => {
    let closed = false;
    let cleanup: (() => Promise<void>) | undefined;
    const onState = (next: typeof state) => {
      if (!closed) socket.send(JSON.stringify(next));
    };
    void subscribe(code, onState).then(async (unsubscribe) => {
      cleanup = unsubscribe;
      if (closed) { await unsubscribe(); return; }
      const latest = await getSession(code);
      if (latest) socket.send(JSON.stringify(latest));
    });
    socket.on("close", () => { closed = true; void cleanup?.(); });
  });
}
