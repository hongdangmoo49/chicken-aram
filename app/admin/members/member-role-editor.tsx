"use client";

import { useMemo, useState } from "react";
import type { EditableRole, MemberRoleChange } from "../../../lib/member-roles";
import type { AppRole } from "../../../lib/app-roles";
import type { Member } from "../../roles";

const roleLabels: Record<AppRole, string> = {
  user: "일반 사용자",
  admin: "관리자",
  super_admin: "슈퍼 관리자",
};

export function MemberRoleEditor({ members, canManageRoles }: { members: Member[]; canManageRoles: boolean }) {
  const baseline = useMemo(() => Object.fromEntries(members.filter((member) => member.role !== "super_admin").map((member) => [member.id, member.role as EditableRole])), [members]);
  const [roles, setRoles] = useState<Record<string, EditableRole>>(() => baseline);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const changes: MemberRoleChange[] = Object.entries(roles).filter(([userId, role]) => baseline[userId] !== role).map(([userId, role]) => ({ userId, role }));

  async function saveChanges() {
    if (!changes.length) return;
    setSaving(true);
    setMessage(`${changes.length}명의 권한을 저장하는 중입니다.`);
    try {
      const response = await fetch("/api/admin/role", { method: "POST", body: new URLSearchParams({ changes: JSON.stringify(changes) }) });
      window.location.assign(response.url);
    } catch {
      setSaving(false);
      setMessage("멤버 권한을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return <>
    {canManageRoles && <div className="member-save-bar"><span><strong>{changes.length}</strong>명 권한 변경 대기</span><div><button className="button ghost" disabled={!changes.length || saving} onClick={() => { setRoles(baseline); setMessage("변경사항을 초기화했습니다."); }} type="button">초기화</button><button className="button primary" disabled={!changes.length || saving} onClick={saveChanges} type="button">{saving ? "저장 중..." : "변경사항 저장"}</button></div></div>}
    <div className="member-list">
      {members.map((member) => <div className="member-row" key={member.id}>
        <div><strong>{member.displayName}</strong><span>{roleLabels[member.role]}</span></div>
        {canManageRoles && member.role !== "super_admin" ? <select aria-label={`${member.displayName} 권한`} disabled={saving} onChange={(event) => setRoles((current) => ({ ...current, [member.id]: event.target.value as EditableRole }))} value={roles[member.id]}><option value="user">일반 사용자</option><option value="admin">관리자</option></select> : <span className="role-badge">{roleLabels[member.role]}</span>}
      </div>)}
    </div>
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </>;
}
