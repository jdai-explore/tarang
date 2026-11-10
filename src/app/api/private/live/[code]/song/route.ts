import { currentSong } from "@/lib/private-live";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const song = await currentSong((await params).code.toUpperCase());
  return song ? Response.json(song, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } })
    : Response.json({ error: "Song unavailable" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
