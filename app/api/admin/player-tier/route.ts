import { setPlayerTiers } from "../../../../db/site-data";
import { normalizeTierChanges } from "../../../../lib/player-tiers";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { isAdmin } from "../../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isAdmin(user.id))) return redirectWithToast(request, "/tiers", "error", "관리자 권한이 필요합니다.");

  const form = await request.formData();
  let value: unknown;
  try {
    value = form.has("changes") ? JSON.parse(String(form.get("changes"))) : [{ playerId: form.get("playerId"), tier: form.get("tier"), order: form.get("order") ?? 0 }];
  } catch { value = null; }
  const changes = normalizeTierChanges(value);
  if (!changes) return redirectWithToast(request, "/tiers", "error", "변경할 선수와 티어를 확인해 주세요.");

  try {
    await setPlayerTiers(changes);
  } catch {
    return redirectWithToast(request, "/tiers", "error", "선수 티어를 일괄 변경하지 못했습니다.");
  }
  return redirectWithToast(request, "/tiers", "success", `${changes.length}명의 티어를 변경했습니다.`);
}
