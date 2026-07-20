import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getPlayerProfile, setPlayerThumbnail } from "../../../../db/site-data";
import { getChatGPTUser } from "../../../chatgpt-auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  const profile = await getPlayerProfile(user.email);
  if (!profile) return new Response("선수 프로필을 먼저 연결해 주세요.", { status: 403 });

  const form = await request.formData();
  const file = form.get("thumbnail");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > 3 * 1024 * 1024) return new Response("3MB 이하의 JPG, PNG, WebP 파일만 사용할 수 있습니다.", { status: 400 });

  const media = env.MEDIA;
  if (!media) return new Response("이미지 저장소를 사용할 수 없습니다.", { status: 503 });
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `players/${profile.id}/${crypto.randomUUID()}.${extension}`;
  await media.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await setPlayerThumbnail(profile.id, key);
  if (profile.thumbnailKey) await media.delete(profile.thumbnailKey);
  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
