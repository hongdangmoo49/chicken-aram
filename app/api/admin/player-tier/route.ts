import { setPlayerTier } from "../../../../db/site-data";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { isAdmin } from "../../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isAdmin(user.id))) return redirectWithToast(request, "/tiers", "error", "관리자 권한이 필요합니다.");

  const form = await request.formData();
  const playerId = Number(form.get("playerId"));
  const tier = Number(form.get("tier"));
  if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(tier) || tier < 1 || tier > 4) {
    return redirectWithToast(request, "/tiers", "error", "선수와 변경할 티어를 확인해 주세요.");
  }

  try {
    await setPlayerTier(playerId, tier);
  } catch {
    return redirectWithToast(request, "/tiers", "error", "선수 티어를 변경하지 못했습니다.");
  }
  return redirectWithToast(request, "/tiers", "success", `선수 티어를 T${tier}로 변경했습니다.`);
}
