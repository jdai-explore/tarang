import { currentLeader } from "@/lib/leaders";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const songs = await sql()`SELECT id, number, title, title_hindi, film, language, lyrics, chord_pro
    FROM tarang_songs ORDER BY number`;
  return Response.json(songs, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!await currentLeader()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const item = await request.json().catch(() => null);
  if (!Number.isSafeInteger(item?.number) || item.number < 1 || item.number > 9999 ||
      typeof item?.title !== "string" || !item.title.trim() || item.title.length > 200 ||
      typeof item?.lyrics !== "string" || !item.lyrics.trim() || item.lyrics.length > 100000 ||
      typeof item?.language !== "string" || !item.language.trim() || item.language.length > 100 ||
      (item.chordPro != null && (typeof item.chordPro !== "string" || item.chordPro.length > 100000)))
    return Response.json({ error: "Invalid song" }, { status: 400 });
  const rows = await sql()`INSERT INTO tarang_songs (number, title, title_hindi, film, language, lyrics, chord_pro)
    VALUES (${item.number}, ${item.title.trim()}, ${typeof item.titleHindi === "string" ? item.titleHindi.slice(0, 200) : ""},
      ${typeof item.film === "string" ? item.film.slice(0, 200) : ""}, ${item.language.trim()}, ${item.lyrics}, ${item.chordPro ?? null})
    ON CONFLICT (number) DO UPDATE SET title = EXCLUDED.title, title_hindi = EXCLUDED.title_hindi,
      film = EXCLUDED.film, language = EXCLUDED.language, lyrics = EXCLUDED.lyrics, chord_pro = EXCLUDED.chord_pro,
      updated_at = now() RETURNING id, number` as { id: number; number: number }[];
  return Response.json(rows[0], { headers: { "Cache-Control": "no-store" } });
}
