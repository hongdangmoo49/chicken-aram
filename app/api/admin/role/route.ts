import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { isSuperAdmin, setMemberRole } from "../../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isSuperAdmin(user.id))) {
    return redirectWithToast(request, "/profile", "error", "슈퍼 관리자 권한이 필요합니다.");
  }

  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  const role = String(form.get("role") ?? "");
  if (!userId || (role !== "user" && role !== "admin")) {
    return redirectWithToast(request, "/profile", "error", "변경할 멤버와 권한을 확인해 주세요.");
  }

  try {
    await setMemberRole(userId, role);
  } catch {
    return redirectWithToast(request, "/profile", "error", "멤버 권한을 변경하지 못했습니다.");
  }
  return redirectWithToast(request, "/profile", "success", role === "admin" ? "관리자로 임명했습니다." : "일반 사용자로 변경했습니다.");
}
