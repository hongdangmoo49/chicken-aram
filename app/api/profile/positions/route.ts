import { getPlayerProfile, setPlayerPositions } from "../../../../db/site-data";
import { normalizePlayerPositions } from "../../../../lib/player-positions";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await takeRateLimit("profile-write", user.id, 30, 600))) return redirectWithToast(request, "/profile", "error", "변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  const form = await request.formData();
  const positions = normalizePlayerPositions(form.getAll("positions").map(String));
  if (!positions) return redirectWithToast(request, "/profile", "error", "선호 포지션은 최대 3개까지 선택해 주세요.");

  const profile = await getPlayerProfile(user.id);
  if (!profile) return redirectWithToast(request, "/profile", "error", "프로필을 찾을 수 없습니다.");

  try {
    await setPlayerPositions(profile.id, positions);
  } catch {
    return redirectWithToast(request, "/profile", "error", "선호 포지션을 저장하지 못했습니다.");
  }
  return redirectWithToast(request, "/profile", "success", "선호 포지션을 저장했습니다.");
}
