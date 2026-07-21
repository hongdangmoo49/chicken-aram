import { deleteScheduledMatch, rebalanceScheduledMatch, replaceScheduledMatchPlayers, updateScheduledMatch } from "../../../../db/site-data";
import { normalizeTeamPlayers } from "../../../../lib/team-players";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { isAdmin } from "../../../roles";

const maps = new Set(["증강 칼바람 협곡", "칼바람 나락"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isAdmin(user.id))) return redirectWithToast(request, "/schedule", "error", "관리자 권한이 필요합니다.");

  const id = Number((await params).id);
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  if (!Number.isInteger(id) || id < 1) return redirectWithToast(request, "/schedule", "error", "대전 정보를 확인해 주세요.");

  try {
    if (action === "delete") {
      await deleteScheduledMatch(id);
      return redirectWithToast(request, "/schedule", "success", "예정 대전을 삭제했습니다.");
    }

    const scheduledAt = String(form.get("scheduledAt") ?? "").trim();
    const map = String(form.get("map") ?? "").trim();
    if ((action !== "update" && action !== "rebalance" && action !== "replacePlayers") || !scheduledAt || Number.isNaN(Date.parse(scheduledAt)) || !maps.has(map)) {
      return redirectWithToast(request, "/schedule", "error", "수정할 일시와 맵을 확인해 주세요.");
    }
    const scheduledAtIso = new Date(`${scheduledAt}+09:00`).toISOString();
    if (action === "replacePlayers") {
      const teams = normalizeTeamPlayers(form.getAll("teamAPlayers"), form.getAll("teamBPlayers"));
      if (!teams) return redirectWithToast(request, "/schedule", "error", "A팀과 B팀에 중복 없이 5명씩 선택해 주세요.");
      await replaceScheduledMatchPlayers({ id, scheduledAt: scheduledAtIso, map, ...teams });
      return redirectWithToast(request, "/schedule", "success", "팀 선수를 교체했습니다.");
    }
    if (action === "rebalance") {
      const playerIds = [...new Set(form.getAll("players").map(Number).filter(Number.isInteger))];
      if (playerIds.length !== 10) return redirectWithToast(request, "/schedule", "error", "팀 재편성에 참가할 선수 10명을 선택해 주세요.");
      const groups = new Map<number, number[]>();
      for (const playerId of playerIds) {
        const group = Number(form.get(`group_${playerId}`));
        if (Number.isInteger(group) && group >= 1 && group <= 5) groups.set(group, [...(groups.get(group) ?? []), playerId]);
      }
      await rebalanceScheduledMatch({ id, scheduledAt: scheduledAtIso, map, playerIds, separatedGroups: [...groups.values()] });
      return redirectWithToast(request, "/schedule", "success", "일정과 팀을 재편성했습니다.");
    }
    await updateScheduledMatch(id, scheduledAtIso, map);
    return redirectWithToast(request, "/schedule", "success", "예정 대전을 수정했습니다.");
  } catch (error) {
    return redirectWithToast(request, "/schedule", "error", error instanceof Error ? error.message : "예정 대전을 변경하지 못했습니다.");
  }
}
