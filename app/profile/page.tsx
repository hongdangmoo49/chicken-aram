import { getPlayerProfile } from "../../db/site-data";
import { requireCurrentUser } from "../auth";
import { getMembers, getRole, roleLabels } from "../roles";
import { PageShell, PlayerAvatar } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 프로필" };

export default async function ProfilePage() {
  const user = await requireCurrentUser("/profile");
  const [profile, role] = await Promise.all([getPlayerProfile(user.id), getRole(user.id)]);
  const members = role === "super_admin" ? await getMembers() : [];
  return <PageShell active="profile">
    <header className="page-intro"><div><span className="eyebrow">PLAYER PROFILE</span><h1>내 프로필</h1></div><p>가입할 때 입력한 닉네임과 선수 썸네일을 직접 수정할 수 있습니다.</p></header>
    {profile ? <section className="profile-card panel">
      <div className="profile-identity"><PlayerAvatar player={profile} large /><div><span className="tier-pill">T{profile.tier}</span><h2>{profile.nickname}</h2><p>{profile.wins}승 {profile.losses}패 · {user.email}</p></div></div>
      <div className="profile-forms">
        <form action="/api/profile/nickname" className="form-grid" method="post">
          <div className="field"><label htmlFor="nickname">닉네임</label><input id="nickname" name="nickname" defaultValue={profile.nickname} maxLength={30} required /></div>
          <button className="button primary" type="submit">닉네임 저장</button>
        </form>
        <form action="/api/profile/thumbnail" className="thumbnail-form" encType="multipart/form-data" method="post">
          <div className="field"><label htmlFor="thumbnail">새 썸네일</label><input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
          <p>JPG, PNG, WebP · 최대 3MB · 정사각형 이미지를 권장합니다.</p>
          <button className="button primary" type="submit">썸네일 저장</button>
        </form>
      </div>
    </section> : <p className="empty panel">프로필을 찾을 수 없습니다.</p>}
    {role === "super_admin" && <section className="member-panel panel">
      <div className="member-heading"><div><span className="eyebrow">MEMBER ACCESS</span><h2>멤버 권한 관리</h2></div><p>슈퍼 관리자는 일반 사용자를 관리자로 임명하거나 다시 일반 사용자로 변경할 수 있습니다.</p></div>
      <div className="member-list">
        {members.map((member) => <div className="member-row" key={member.id}>
          <div><strong>{member.displayName}</strong><span>{roleLabels[member.role]}</span></div>
          {member.role === "super_admin" ? <span className="role-badge">슈퍼 관리자</span> : <form action="/api/admin/role" method="post">
            <input name="userId" type="hidden" value={member.id} />
            <select name="role" defaultValue={member.role} aria-label={`${member.displayName} 권한`}><option value="user">일반 사용자</option><option value="admin">관리자</option></select>
            <button className="button ghost" type="submit">권한 저장</button>
          </form>}
        </div>)}
      </div>
    </section>}
  </PageShell>;
}
