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

const rate = (wins: number, losses: number) => wins + losses ? Math.round(wins / (wins + losses) * 100) : 0;

export function MemberRoleEditor({ members, canManageRoles, currentUserId }: { members: Member[]; canManageRoles: boolean; currentUserId: string }) {
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
      {members.map((member) => {
        const canDelete = canManageRoles && member.id !== currentUserId && member.role !== "super_admin" && member.email;
        return <div className="member-row" key={member.id}>
          <div><strong>{member.displayName}</strong>{member.email && <span>{member.email}</span>}<span>{roleLabels[member.role]}</span>{member.record && <div className="member-records">
            <span>라운드 <strong>{member.record.roundWins}승 {member.record.roundLosses}패 · 승률 {rate(member.record.roundWins, member.record.roundLosses)}%</strong></span>
            <span>경기 <strong>{member.record.matchWins}승 {member.record.matchLosses}패 · 승률 {rate(member.record.matchWins, member.record.matchLosses)}%</strong></span>
            <span>최근 5경기 <strong>{member.record.recentMatches}</strong></span>
          </div>}</div>
          <div className="member-controls">
            {canManageRoles && member.role !== "super_admin" ? <select aria-label={`${member.displayName} 권한`} disabled={saving} onChange={(event) => setRoles((current) => ({ ...current, [member.id]: event.target.value as EditableRole }))} value={roles[member.id]}><option value="user">일반 사용자</option><option value="admin">관리자</option></select> : <span className="role-badge">{roleLabels[member.role]}</span>}
            {canDelete && <details className="member-delete">
              <summary>계정 삭제</summary>
              <form action={`/api/admin/member/${member.id}`} method="post">
                <p>로그인 계정만 삭제되며 선수·경기 기록은 유지됩니다.</p>
                <label htmlFor={`delete-email-${member.id}`}>삭제 확인 이메일</label>
                <input autoComplete="off" id={`delete-email-${member.id}`} name="confirmationEmail" placeholder={member.email ?? ""} required type="email" />
                <button className="button danger" type="submit">로그인 계정 삭제</button>
              </form>
            </details>}
          </div>
        </div>;
      })}
    </div>
    <p className="sr-status" aria-live="polite" role="status">{message}</p>
  </>;
}
