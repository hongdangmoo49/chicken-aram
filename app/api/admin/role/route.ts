import { normalizeMemberRoleChanges } from "../../../../lib/member-roles";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";
import { isSuperAdmin, setMemberRoles } from "../../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await isSuperAdmin(user.id))) {
    return redirectWithToast(request, "/admin/members", "error", "슈퍼 관리자 권한이 필요합니다.");
  }

  const form = await request.formData();
  let value: unknown;
  try {
    value = form.has("changes") ? JSON.parse(String(form.get("changes"))) : [{ userId: form.get("userId"), role: form.get("role") }];
  } catch { value = null; }
  const changes = normalizeMemberRoleChanges(value);
  if (!changes) return redirectWithToast(request, "/admin/members", "error", "변경할 멤버와 권한을 확인해 주세요.");

  try {
    await setMemberRoles(changes);
  } catch {
    return redirectWithToast(request, "/admin/members", "error", "멤버 권한을 일괄 변경하지 못했습니다.");
  }
  return redirectWithToast(request, "/admin/members", "success", `${changes.length}명의 권한을 변경했습니다.`);
}
