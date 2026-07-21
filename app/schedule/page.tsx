import { getMatchParticipants, getMatches, getPlayers } from "../../db/site-data";
import { getCurrentUser } from "../auth";
import { isAdmin } from "../roles";
import { MatchCard, PageShell } from "../ui";
import { ParticipantPicker } from "./participant-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "대전 예정" };
const maps = ["증강 칼바람 협곡", "칼바람 나락"];

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(value)).replace(" ", "T");
}

export default async function SchedulePage() {
  const [matches, players, members, user] = await Promise.all([getMatches(), getPlayers(), getMatchParticipants(), getCurrentUser()]);
  const upcoming = matches.filter((match) => match.status === "scheduled");
  const admin = user ? await isAdmin(user.id) : false;
  return <PageShell active="schedule">
    <header className="page-intro"><div><span className="eyebrow">UPCOMING MATCHES</span><h1>대전 예정</h1></div><p>참가자 10명을 고르면 티어와 승률을 기준으로 가장 균형에 가까운 A팀과 B팀을 만듭니다.</p></header>
    <div className="schedule-grid">
      <div className="match-list">{upcoming.length ? upcoming.map((match) => {
        const matchMembers = members.filter((member) => member.matchId === match.id);
        const initialGroups = Object.fromEntries(matchMembers.filter((member) => member.separatedGroup !== null).map((member) => [member.playerId, member.separatedGroup!])) as Record<number, number>;
        return <div className={`scheduled-match${admin ? " manageable" : ""}`} key={match.id}>
        <MatchCard match={match} />
        {admin && <div className="match-admin-actions">
          <details><summary>수정 · 팀 재편성</summary><form action={`/api/schedule/${match.id}`} className="match-edit-form" method="post">
            <div className="field"><label htmlFor={`scheduledAt-${match.id}`}>일시</label><input id={`scheduledAt-${match.id}`} name="scheduledAt" type="datetime-local" defaultValue={localDateTime(match.scheduledAt)} required /></div>
            <div className="field"><label htmlFor={`map-${match.id}`}>맵</label><select id={`map-${match.id}`} name="map" defaultValue={match.map}>{maps.map((map) => <option key={map}>{map}</option>)}</select></div>
            <ParticipantPicker initialGroups={initialGroups} initialSelectedIds={matchMembers.map((member) => member.playerId)} players={players} />
            <div className="match-edit-actions"><button className="button ghost" name="action" type="submit" value="update">일정만 저장</button><button className="button primary" name="action" type="submit" value="rebalance">팀 재편성</button></div>
          </form></details>
          <details className="delete-action"><summary>삭제</summary><form action={`/api/schedule/${match.id}`} method="post"><input name="action" type="hidden" value="delete" /><p>삭제하면 복구할 수 없습니다.</p><button className="button danger" type="submit">삭제 확정</button></form></details>
        </div>}
      </div>;}) : <p className="empty panel">예정된 대전이 없습니다.</p>}</div>
      <aside className="admin-panel team-builder">
        <h2>새 대전 · 팀 나누기</h2><p>관리자 전용 · 정확히 10명을 선택하세요.</p>
        {admin ? <form action="/api/schedule" className="form-grid" method="post">
          <div className="field"><label htmlFor="scheduledAt">일시</label><input defaultValue={localDateTime(new Date().toISOString())} id="scheduledAt" name="scheduledAt" type="datetime-local" required /></div>
          <div className="field"><label htmlFor="map">맵</label><select id="map" name="map">{maps.map((map) => <option key={map}>{map}</option>)}</select></div>
          <ParticipantPicker players={players} />
          <button className="button primary" type="submit">팀 나누기 · 일정 생성</button>
        </form> : <div className="permission-note"><strong>{user ? "일반 계정으로 로그인됨" : "로그인이 필요합니다"}</strong>{user ? "팀 나누기 권한은 관리자 계정에만 제공됩니다." : "로그인 후 계정 권한에 따라 관리 기능이 표시됩니다."}</div>}
      </aside>
    </div>
  </PageShell>;
}
