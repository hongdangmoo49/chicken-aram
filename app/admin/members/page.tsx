import { redirect } from "next/navigation";
import { withToast } from "../../../lib/toast";
import { requireCurrentUser } from "../../auth";
import { getMembers } from "../../roles";
import { PageShell } from "../../ui";
import { MemberRoleEditor } from "./member-role-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "멤버 관리" };

export default async function MembersPage() {
  const user = await requireCurrentUser("/admin/members");
  const role = user.role;
  if (role === "user") redirect(withToast("/profile", "error", "관리자 권한이 필요합니다."));

  const members = await getMembers();
  const canManageRoles = role === "super_admin";

  return <PageShell active="admin">
    <header className="page-intro"><div><span className="eyebrow">MEMBER ACCESS</span><h1>멤버 관리</h1></div><p>{canManageRoles ? "일반 사용자를 관리자로 임명하거나 다시 일반 사용자로 변경할 수 있습니다." : "가입한 멤버와 현재 권한을 확인할 수 있습니다. 권한 변경은 슈퍼 관리자만 할 수 있습니다."}</p></header>
    <section className="member-panel panel">
      <div className="member-heading"><div><span className="eyebrow">ACCESS LEVEL</span><h2>멤버 권한 관리</h2></div><p>슈퍼 관리자 · 관리자 · 일반 사용자 권한을 구분해 표시합니다.</p></div>
      <MemberRoleEditor canManageRoles={canManageRoles} members={members} />
    </section>
  </PageShell>;
}
