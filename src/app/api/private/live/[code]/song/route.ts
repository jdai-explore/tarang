import { currentSong } from "@/lib/private-live";
import { invalidLookupStatus } from "@/lib/lookup-limit";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const song = await currentSong((await params).code.toUpperCase());
  return song ? Response.json(song, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } })
    : Response.json({ error: "Song unavailable" }, { status: await invalidLookupStatus(request), headers: { "Cache-Control": "private, no-store" } });
}
