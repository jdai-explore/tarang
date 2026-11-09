import { updateSession } from "@/lib/live";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const body = await request.json();
    const state = await updateSession((await params).code.toUpperCase(), body.token, body.song, body.position);
    return state ? Response.json(state) : Response.json({ error: "Invalid update" }, { status: 403 });
  } catch {
    return Response.json({ error: "Live update failed" }, { status: 503 });
  }
}
