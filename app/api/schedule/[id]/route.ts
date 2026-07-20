import { deleteScheduledMatch, updateScheduledMatch } from "../../../../db/site-data";
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
    if (action !== "update" || !scheduledAt || Number.isNaN(Date.parse(scheduledAt)) || !maps.has(map)) {
      return redirectWithToast(request, "/schedule", "error", "수정할 일시와 맵을 확인해 주세요.");
    }
    await updateScheduledMatch(id, new Date(`${scheduledAt}+09:00`).toISOString(), map);
    return redirectWithToast(request, "/schedule", "success", "예정 대전을 수정했습니다.");
  } catch (error) {
    return redirectWithToast(request, "/schedule", "error", error instanceof Error ? error.message : "예정 대전을 변경하지 못했습니다.");
  }
}
