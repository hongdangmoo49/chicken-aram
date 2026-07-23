import { createBalancedSchedule } from "../../../db/site-data";
import { redirectWithToast } from "../../../lib/toast-response";
import { takeRateLimit } from "../../../lib/rate-limit";
import { getCurrentUser } from "../../auth";
import { isAdmin } from "../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isAdmin(user.id))) return redirectWithToast(request, "/schedule", "error", "관리자 권한이 필요합니다.");
  if (!(await takeRateLimit("admin-write", user.id, 60, 600))) return redirectWithToast(request, "/schedule", "error", "관리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  const form = await request.formData();
  const scheduledAt = String(form.get("scheduledAt") ?? "").trim();
  const map = String(form.get("map") ?? "증강 칼바람 협곡").trim();
  const playerIds = [...new Set(form.getAll("players").map(Number).filter(Number.isInteger))];
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt)) || playerIds.length !== 10) return redirectWithToast(request, "/schedule", "error", "일시와 참가 선수 10명을 확인해 주세요.");

  const groups = new Map<number, number[]>();
  for (const playerId of playerIds) {
    const group = Number(form.get(`group_${playerId}`));
    if (Number.isInteger(group) && group >= 1 && group <= 5) groups.set(group, [...(groups.get(group) ?? []), playerId]);
  }

  try {
    await createBalancedSchedule({ scheduledAt: new Date(`${scheduledAt}+09:00`).toISOString(), map, playerIds, separatedGroups: [...groups.values()], createdBy: user.id });
  } catch (error) {
    console.error("schedule creation failed", error);
    return redirectWithToast(request, "/schedule", "error", "팀을 나누지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return redirectWithToast(request, "/schedule", "success", "대전 일정과 팀을 만들었습니다.");
}
