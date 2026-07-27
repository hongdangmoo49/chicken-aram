import type { AppRole } from "../../../../../lib/app-roles";
import { isMemberUserId, validateMemberAccountDeletion } from "../../../../../lib/member-roles";
import { reportError } from "../../../../../lib/observability";
import { takeRateLimit } from "../../../../../lib/rate-limit";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { redirectWithToast } from "../../../../../lib/toast-response";
import { getCurrentUser } from "../../../../auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (user.role !== "super_admin") return redirectWithToast(request, "/admin/members", "error", "슈퍼 관리자 권한이 필요합니다.");
  if (!(await takeRateLimit("admin-write", user.id, 60, 600))) return redirectWithToast(request, "/admin/members", "error", "관리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  const targetId = (await params).id;
  const confirmationEmail = String((await request.formData()).get("confirmationEmail") ?? "");
  if (!isMemberUserId(targetId)) return redirectWithToast(request, "/admin/members", "error", "삭제할 멤버를 확인해 주세요.");

  const admin = createSupabaseAdminClient();
  const [{ data: profile, error: profileError }, { data: authData, error: authError }] = await Promise.all([
    admin.from("profiles").select("display_name,role,player_id").eq("id", targetId).maybeSingle(),
    admin.auth.admin.getUserById(targetId),
  ]);
  const targetRole = profile?.role;
  if (profileError || authError || !profile || !authData.user || (targetRole !== "user" && targetRole !== "admin" && targetRole !== "super_admin")) {
    const errorId = reportError("member.account.lookup", profileError ?? authError ?? new Error("Member account not found"), { targetId });
    return redirectWithToast(request, "/admin/members", "error", `멤버 계정을 확인하지 못했습니다. 오류 번호: ${errorId.slice(0, 8)}`);
  }

  const validationError = validateMemberAccountDeletion({
    actorId: user.id,
    targetId,
    targetRole: targetRole as AppRole,
    targetEmail: authData.user.email ?? null,
    confirmationEmail,
  });
  if (validationError === "self") return redirectWithToast(request, "/admin/members", "error", "현재 로그인한 계정은 삭제할 수 없습니다.");
  if (validationError === "protected") return redirectWithToast(request, "/admin/members", "error", "슈퍼 관리자 계정은 삭제할 수 없습니다.");
  if (validationError === "email") return redirectWithToast(request, "/admin/members", "error", "삭제 확인 이메일이 일치하지 않습니다.");

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    const errorId = reportError("member.account.delete", deleteError, { targetId });
    return redirectWithToast(request, "/admin/members", "error", `멤버 계정을 삭제하지 못했습니다. 오류 번호: ${errorId.slice(0, 8)}`);
  }

  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_name: user.displayName,
    action: "members.account.delete",
    entity_type: "auth_user",
    entity_id: targetId,
    before_data: {
      displayName: profile.display_name,
      role: targetRole,
      playerId: profile.player_id,
    },
    after_data: null,
  });
  if (auditError) reportError("member.account.delete.audit", auditError, { targetId });

  return redirectWithToast(request, "/admin/members", "success", `${profile.display_name || "멤버"} 로그인 계정을 삭제했습니다.`);
}
