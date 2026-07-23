import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { AppRole } from "../lib/app-roles";
import type { MemberRoleChange } from "../lib/member-roles";

export type { AppRole } from "../lib/app-roles";

export type Member = {
  id: string;
  displayName: string;
  role: AppRole;
};

export type AuditLog = {
  id: number;
  actorName: string;
  action: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
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

export async function setMemberRoles(changes: MemberRoleChange[], actorId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("set_member_roles", { changes, p_actor_id: actorId });
  if (error) throw new Error(`멤버 권한 변경 실패: ${error.message}`);
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("id,actor_name,action,entity_id,before_data,after_data,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`변경 기록 조회 실패: ${error.message}`);
  return (data ?? []).map((log) => ({
    id: Number(log.id),
    actorName: log.actor_name,
    action: log.action,
    entityId: log.entity_id,
    before: log.before_data,
    after: log.after_data,
    createdAt: log.created_at,
  }));
}
