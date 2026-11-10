import { currentLeader } from "@/lib/leaders";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const songs = await sql()`SELECT id, number, title, title_hindi, film, language, lyrics, chord_pro
    FROM tarang_songs ORDER BY number`;
  return Response.json((songs as { id: string; [key: string]: unknown }[]).map((song) => ({ ...song, id: Number(song.id) })),
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const item = await request.json().catch(() => null);
  if (!Number.isSafeInteger(item?.number) || item.number < 1 || item.number > 9999 ||
      (item.id !== undefined && (!Number.isSafeInteger(item.id) || item.id < 1)) ||
      typeof item?.title !== "string" || !item.title.trim() || item.title.length > 200 ||
      typeof item?.lyrics !== "string" || !item.lyrics.trim() || item.lyrics.length > 100000 ||
      typeof item?.language !== "string" || !item.language.trim() || item.language.length > 100 ||
      (item.chordPro != null && (typeof item.chordPro !== "string" || item.chordPro.length > 100000)))
    return Response.json({ error: "Invalid song" }, { status: 400 });
  const hindi = typeof item.titleHindi === "string" ? item.titleHindi.slice(0, 200) : "";
  const film = typeof item.film === "string" ? item.film.slice(0, 200) : "";
  try {
    const rows = item.id && Number.isSafeInteger(item.id) && item.id > 0
      ? await sql()`UPDATE tarang_songs SET number = ${item.number}, title = ${item.title.trim()},
        title_hindi = ${hindi}, film = ${film}, language = ${item.language.trim()}, lyrics = ${item.lyrics},
        chord_pro = ${item.chordPro ?? null}, updated_at = now() WHERE id = ${item.id} RETURNING id, number` as { id: string; number: number }[]
      : await sql()`INSERT INTO tarang_songs (number, title, title_hindi, film, language, lyrics, chord_pro)
        VALUES (${item.number}, ${item.title.trim()}, ${hindi}, ${film}, ${item.language.trim()}, ${item.lyrics}, ${item.chordPro ?? null})
        RETURNING id, number` as { id: string; number: number }[];
    return rows.length ? Response.json({ id: Number(rows[0].id), number: rows[0].number }, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Song not found" }, { status: 404 });
  } catch {
    return Response.json({ error: "Could not save song. Check for a duplicate number." }, { status: 409 });
  }
}
