import { getPlayerProfile, getUnclaimedPlayers } from "../../db/site-data";
import { requireCurrentUser } from "../auth";
import { PageShell, PlayerAvatar } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 프로필" };

export default async function ProfilePage() {
  const user = await requireCurrentUser("/profile");
  const [profile, unclaimed] = await Promise.all([getPlayerProfile(user.id), getUnclaimedPlayers()]);
  return <PageShell active="profile">
    <header className="page-intro"><div><span className="eyebrow">PLAYER PROFILE</span><h1>내 프로필</h1></div><p>처음 한 번 닉네임을 연결하면 이후에는 직접 선수 썸네일을 바꿀 수 있습니다.</p></header>
    {profile ? <section className="profile-card panel">
      <div className="profile-identity"><PlayerAvatar player={profile} large /><div><span className="tier-pill">T{profile.tier}</span><h2>{profile.nickname}</h2><p>{profile.wins}승 {profile.losses}패 · {user.email}</p></div></div>
      <form action="/api/profile/thumbnail" className="thumbnail-form" encType="multipart/form-data" method="post">
        <div className="field"><label htmlFor="thumbnail">새 썸네일</label><input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
        <p>JPG, PNG, WebP · 최대 3MB · 정사각형 이미지를 권장합니다.</p>
        <button className="button primary" type="submit">썸네일 저장</button>
      </form>
    </section> : <section className="claim-card panel"><h2>내 선수 닉네임 연결</h2><p>본인 닉네임을 선택하세요. 한 번 연결된 닉네임은 다른 계정이 선택할 수 없습니다.</p><form action="/api/profile/claim" className="claim-form" method="post"><select name="playerId" required defaultValue=""><option value="" disabled>선수 선택</option>{unclaimed.map((player) => <option value={player.id} key={player.id}>{player.nickname} · T{player.tier}</option>)}</select><button className="button primary" type="submit">내 닉네임으로 연결</button></form></section>}
  </PageShell>;
}
