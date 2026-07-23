import { saveMatchResult } from "../../../../db/site-data";
import { normalizeMatchResult } from "../../../../lib/match-results";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (user.role === "user") return redirectWithToast(request, "/results", "error", "관리자 권한이 필요합니다.");
  if (!(await takeRateLimit("admin-write", user.id, 60, 600))) return redirectWithToast(request, "/results", "error", "관리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  const matchId = Number((await params).id);
  const form = await request.formData();
  const result = normalizeMatchResult({ playedAt: form.get("playedAt"), aScore: form.get("aScore"), bScore: form.get("bScore"), winner: form.get("winner"), mvpPlayerId: form.get("mvpPlayerId") });
  if (!Number.isInteger(matchId) || matchId < 1 || !result) return redirectWithToast(request, "/results", "error", "점수, 승리팀, MVP와 경기 일시를 확인해 주세요.");

  try {
    await saveMatchResult({ matchId, ...result });
  } catch (error) {
    console.error("match result save failed", error);
    return redirectWithToast(request, "/results", "error", "대전 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return redirectWithToast(request, "/results", "success", "대전 결과와 선수 승패를 저장했습니다.");
}
