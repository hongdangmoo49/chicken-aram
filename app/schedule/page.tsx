import { getMatches, getPlayers } from "../../db/site-data";
import { getChatGPTUser } from "../chatgpt-auth";
import { isAdmin } from "../roles";
import { MatchCard, PageShell, PlayerAvatar } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "대전 예정" };

export default async function SchedulePage() {
  const [matches, players, user] = await Promise.all([getMatches(), getPlayers(), getChatGPTUser()]);
  const upcoming = matches.filter((match) => match.status === "scheduled");
  const admin = user ? isAdmin(user.email) : false;
  return <PageShell active="schedule">
    <header className="page-intro"><div><span className="eyebrow">UPCOMING MATCHES</span><h1>대전 예정</h1></div><p>참가자 10명을 고르면 티어와 승률을 기준으로 가장 균형에 가까운 A팀과 B팀을 만듭니다.</p></header>
    <div className="schedule-grid">
      <div className="match-list">{upcoming.length ? upcoming.map((match) => <MatchCard key={match.id} match={match} />) : <p className="empty panel">예정된 대전이 없습니다.</p>}</div>
      <aside className="admin-panel team-builder">
        <h2>새 대전 · 팀 나누기</h2><p>관리자 전용 · 정확히 10명을 선택하세요.</p>
        {admin ? <form action="/api/schedule" className="form-grid" method="post">
          <div className="field"><label htmlFor="scheduledAt">일시</label><input id="scheduledAt" name="scheduledAt" type="datetime-local" required /></div>
          <div className="field"><label htmlFor="map">맵</label><select id="map" name="map"><option>증강 칼바람 협곡</option><option>칼바람 나락</option></select></div>
          <div className="picker-heading"><strong>참가 선수</strong><span>분리 그룹은 같은 숫자끼리 다른 팀으로 배치</span></div>
          <div className="participant-picker">
            {players.map((player) => <div className="participant-option" key={player.id}>
              <label htmlFor={`player-${player.id}`}><input id={`player-${player.id}`} name="players" type="checkbox" value={player.id} /><PlayerAvatar player={player} /><span><strong>{player.nickname}</strong><small>T{player.tier} · {player.wins}승 {player.losses}패</small></span></label>
              <select name={`group_${player.id}`} aria-label={`${player.nickname} 분리 그룹`} defaultValue=""><option value="">분리 없음</option>{[1,2,3,4,5].map((group) => <option value={group} key={group}>그룹 {group}</option>)}</select>
            </div>)}
          </div>
          <button className="button primary" type="submit">팀 나누기 · 일정 생성</button>
        </form> : <div className="permission-note"><strong>{user ? "일반 계정으로 로그인됨" : "로그인이 필요합니다"}</strong>{user ? "팀 나누기 권한은 관리자 계정에만 제공됩니다." : "로그인 후 계정 권한에 따라 관리 기능이 표시됩니다."}</div>}
      </aside>
    </div>
  </PageShell>;
}
