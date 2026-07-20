import { NextResponse } from "next/server";
import { getPlayerProfile, setPlayerThumbnail } from "../../../../db/site-data";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  const profile = await getPlayerProfile(user.id);
  if (!profile) return new Response("선수 프로필을 먼저 연결해 주세요.", { status: 403 });

  const form = await request.formData();
  const file = form.get("thumbnail");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > 3 * 1024 * 1024) {
    return new Response("3MB 이하의 JPG, PNG, WebP 파일만 사용할 수 있습니다.", { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from("player-thumbnails")
    .upload(key, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) return new Response("이미지를 저장하지 못했습니다.", { status: 500 });

  try {
    await setPlayerThumbnail(profile.id, key);
  } catch (error) {
    await admin.storage.from("player-thumbnails").remove([key]);
    throw error;
  }
  if (profile.thumbnailKey) {
    await admin.storage.from("player-thumbnails").remove([profile.thumbnailKey]);
  }
  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
