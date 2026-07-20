import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { MemberRoleChange } from "../lib/member-roles";

export type AppRole = "user" | "admin" | "super_admin";

export type Member = {
  id: string;
  displayName: string;
  role: AppRole;
};

export const roleLabels: Record<AppRole, string> = {
  user: "일반 사용자",
  admin: "관리자",
  super_admin: "슈퍼 관리자",
};

export async function getRole(userId: string): Promise<AppRole> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`계정 권한 조회 실패: ${error.message}`);
  return data?.role === "admin" || data?.role === "super_admin" ? data.role : "user";
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) !== "user";
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === "super_admin";
}

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
