import { getPlayerProfile } from "../../db/site-data";
import { playerTierLabel } from "../../lib/player-tiers";
import { requireCurrentUser } from "../auth";
import { PageShell, PlayerAvatar, PlayerPositions } from "../ui";
import { PositionPicker } from "./position-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 프로필" };

export default async function ProfilePage() {
  const user = await requireCurrentUser("/profile");
  const profile = await getPlayerProfile(user.id);
  const roundRate = profile && profile.roundWins + profile.roundLosses ? Math.round(profile.roundWins / (profile.roundWins + profile.roundLosses) * 100) : 0;
  return <PageShell active="profile">
    <header className="page-intro"><div><span className="eyebrow">PLAYER PROFILE</span><h1>내 프로필</h1></div><p>가입할 때 입력한 닉네임과 선수 썸네일을 직접 수정할 수 있습니다.</p></header>
    {profile ? <section className="profile-card panel">
      <div className="profile-identity"><PlayerAvatar player={profile} large /><div><div className="profile-tags"><span className={`tier-pill profile-tier tier-badge-${profile.tier}`}>{playerTierLabel(profile.tier)}</span><PlayerPositions positions={profile.positions} /></div><h2>{profile.nickname}</h2><p>대전 전적 {profile.wins}승 {profile.losses}패 · {user.email}</p><p className="round-record">라운드 승률 <strong>{roundRate}%</strong> · {profile.roundWins}승 {profile.roundLosses}패</p></div></div>
      <div className="profile-forms">
        <form action="/api/profile/nickname" className="form-grid" method="post">
          <div className="field"><label htmlFor="nickname">닉네임</label><input id="nickname" name="nickname" defaultValue={profile.nickname} maxLength={30} required /></div>
          <button className="button primary" type="submit">닉네임 저장</button>
        </form>
        <PositionPicker initialPositions={profile.positions} />
        <form action="/api/profile/thumbnail" className="thumbnail-form" encType="multipart/form-data" method="post">
          <div className="field"><label htmlFor="thumbnail">새 썸네일</label><input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
          <p>JPG, PNG, WebP · 최대 3MB · 정사각형 이미지를 권장합니다.</p>
          <button className="button primary" type="submit">썸네일 저장</button>
        </form>
      </div>
    </section> : <p className="empty panel">프로필을 찾을 수 없습니다.</p>}
  </PageShell>;
}
