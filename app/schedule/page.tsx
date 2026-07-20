import { getMatches } from "../../db/site-data";
import { getChatGPTUser } from "../chatgpt-auth";
import { isAdmin } from "../roles";
import { MatchCard, PageShell } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "대전 예정" };

export default async function SchedulePage() {
  const [matches, user] = await Promise.all([getMatches(), getChatGPTUser()]);
  const upcoming = matches.filter((match) => match.status === "scheduled");
  const admin = user ? isAdmin(user.email) : false;
  return <PageShell active="schedule">
    <header className="page-intro"><div><span className="eyebrow">UPCOMING MATCHES</span><h1>대전 예정</h1></div><p>다가오는 내전 일정과 팀 구성을 확인하세요. 새 대전 등록은 관리자만 할 수 있습니다.</p></header>
    <div className="schedule-grid">
      <div className="match-list">{upcoming.length ? upcoming.map((match) => <MatchCard key={match.id} match={match} />) : <p className="empty panel">예정된 대전이 없습니다.</p>}</div>
      <aside className="admin-panel">
        <h2>새 대전 만들기</h2><p>관리자 전용 · 등록 즉시 일정에 반영됩니다.</p>
        {admin ? <form action="/api/schedule" className="form-grid" method="post">
          <div className="field"><label htmlFor="scheduledAt">일시</label><input id="scheduledAt" name="scheduledAt" type="datetime-local" required /></div>
          <div className="field"><label htmlFor="teamRed">레드 팀</label><input id="teamRed" name="teamRed" placeholder="예: 직장인 원정대" required maxLength={40} /></div>
          <div className="field"><label htmlFor="teamBlue">블루 팀</label><input id="teamBlue" name="teamBlue" placeholder="예: 새벽의 치킨단" required maxLength={40} /></div>
          <div className="field"><label htmlFor="map">맵</label><select id="map" name="map"><option>증강 칼바람 협곡</option><option>칼바람 나락</option></select></div>
          <button className="button primary" type="submit">대전 등록하기</button>
        </form> : <div className="permission-note"><strong>{user ? "일반 계정으로 로그인됨" : "로그인이 필요합니다"}</strong>{user ? "대전 생성 권한은 관리자 계정에만 제공됩니다." : "로그인 후 계정 권한에 따라 관리 기능이 표시됩니다."}</div>}
      </aside>
    </div>
  </PageShell>;
}
