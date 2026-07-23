import { getPlayerProfile, setPlayerThumbnail } from "../../../../db/site-data";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await takeRateLimit("thumbnail-upload", user.id, 10, 3600))) return redirectWithToast(request, "/profile", "error", "이미지 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  const profile = await getPlayerProfile(user.id);
  if (!profile) return redirectWithToast(request, "/profile", "error", "프로필을 찾을 수 없습니다.");

  const form = await request.formData();
  const file = form.get("thumbnail");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > 3 * 1024 * 1024) {
    return redirectWithToast(request, "/profile", "error", "3MB 이하의 JPG, PNG, WebP 파일만 사용할 수 있습니다.");
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from("player-thumbnails")
    .upload(key, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) return redirectWithToast(request, "/profile", "error", "이미지를 저장하지 못했습니다.");

  try {
    await setPlayerThumbnail(profile.id, key);
  } catch {
    await admin.storage.from("player-thumbnails").remove([key]);
    return redirectWithToast(request, "/profile", "error", "썸네일 정보를 저장하지 못했습니다.");
  }
  if (profile.thumbnailKey) {
    await admin.storage.from("player-thumbnails").remove([profile.thumbnailKey]);
  }
  return redirectWithToast(request, "/profile", "success", "썸네일을 변경했습니다.");
}
