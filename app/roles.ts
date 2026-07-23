import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { AppRole } from "../lib/app-roles";
import type { MemberRoleChange } from "../lib/member-roles";

export type { AppRole } from "../lib/app-roles";

export type Member = {
  id: string;
  displayName: string;
  role: AppRole;
};

export async function getMembers(): Promise<Member[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,display_name,role")
    .order("created_at");
  if (error) throw new Error(`멤버 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((member) => ({
    id: member.id,
    displayName: member.display_name || "이름 없음",
    role: member.role as AppRole,
  }));
}

export async function setMemberRoles(changes: MemberRoleChange[]) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("set_member_roles", { changes });
  if (error) throw new Error(`멤버 권한 변경 실패: ${error.message}`);
}
