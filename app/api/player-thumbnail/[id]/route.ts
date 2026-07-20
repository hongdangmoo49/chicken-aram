import { env } from "cloudflare:workers";
import { getPlayerThumbnailKey } from "../../../../db/site-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId)) return new Response("Not found", { status: 404 });
  const key = await getPlayerThumbnailKey(playerId);
  if (!key || !env.MEDIA) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "public, max-age=3600" } });
}
