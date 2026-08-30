import { syncTelegramMvpMessage } from "../../../../db/telegram-mvp";
import { reportError } from "../../../../lib/observability";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { finalizeMatchMvp } from "../../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (user.role !== "super_admin") return redirectWithToast(request, "/admin/members", "error", "슈퍼 관리자 권한이 필요합니다.");
  if (!(await takeRateLimit("admin-write", user.id, 60, 600))) return redirectWithToast(request, "/admin/members", "error", "관리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  const form = await request.formData();
  const matchId = Number(form.get("matchId"));
  const playerId = Number(form.get("playerId"));
  if (!Number.isInteger(matchId) || matchId < 1 || !Number.isInteger(playerId) || playerId < 1) {
    return redirectWithToast(request, "/admin/members", "error", "경기와 MVP 선수를 확인해 주세요.");
  }

  try {
    await finalizeMatchMvp({ matchId, playerId, actorId: user.id });
  } catch (error) {
    const errorId = reportError("admin.mvp.finalize", error, { matchId, playerId });
    return redirectWithToast(request, "/admin/members", "error", `MVP를 확정하지 못했습니다. 오류 번호: ${errorId.slice(0, 8)}`);
  }

  try {
    await syncTelegramMvpMessage(matchId);
  } catch (error) {
    reportError("admin.mvp.telegram-sync", error, { matchId });
  }
  return redirectWithToast(request, "/admin/members", "success", "MVP를 확정하고 RP 1점을 지급했습니다.");
}
