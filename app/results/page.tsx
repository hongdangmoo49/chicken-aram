import Link from "next/link";
import { getMatchCounts, getMatchParticipants, getMatches, getPlayers, type Match, type Player } from "../../db/site-data";
import { getCurrentUser } from "../auth";
import { isAdmin } from "../roles";
import { MatchCard, PageShell } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "대전 결과" };

type ResultParticipant = Pick<Player, "id" | "nickname">;

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(value)).replace(" ", "T");
}

function ResultForm({ match, participants, submitLabel }: { match: Match; participants: ResultParticipant[]; submitLabel: string }) {
  const winner = match.winner ?? (match.redScore !== null && match.blueScore !== null ? match.redScore > match.blueScore ? "A" : "B" : "A");
  return <form action={`/api/results/${match.id}`} className="result-form" method="post">
    <div className="field"><label htmlFor={`playedAt-${match.id}`}>경기 일시</label><input defaultValue={localDateTime(match.scheduledAt)} id={`playedAt-${match.id}`} name="playedAt" type="datetime-local" required /></div>
    <div className="field"><label htmlFor={`aScore-${match.id}`}>A팀 점수</label><input defaultValue={match.redScore ?? ""} id={`aScore-${match.id}`} max="99" min="0" name="aScore" type="number" required /></div>
    <div className="field"><label htmlFor={`bScore-${match.id}`}>B팀 점수</label><input defaultValue={match.blueScore ?? ""} id={`bScore-${match.id}`} max="99" min="0" name="bScore" type="number" required /></div>
    <div className="field"><label htmlFor={`winner-${match.id}`}>승리팀</label><select defaultValue={winner} id={`winner-${match.id}`} name="winner"><option value="A">A팀</option><option value="B">B팀</option></select></div>
    <div className="field"><label htmlFor={`mvp-${match.id}`}>MVP</label><select defaultValue={match.mvpPlayerId ?? ""} id={`mvp-${match.id}`} name="mvpPlayerId" required><option disabled value="">선수 선택</option>{participants.map((player) => <option key={player.id} value={player.id}>{player.nickname}</option>)}</select></div>
    <button className="button primary" type="submit">{submitLabel}</button>
  </form>;
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 10;
  const [completed, scheduled, players, user, matchCounts] = await Promise.all([
    getMatches({ status: "completed", limit: pageSize, offset: (page - 1) * pageSize }),
    getMatches({ status: "scheduled", limit: 50, ascending: true }),
    getPlayers(),
    getCurrentUser(),
    getMatchCounts(),
  ]);
  const members = await getMatchParticipants([...completed, ...scheduled].map((match) => match.id));
  const totalPages = Math.max(1, Math.ceil(matchCounts.completed / pageSize));
  const admin = user ? await isAdmin(user.id) : false;
  const playerById = new Map(players.map((player) => [player.id, player]));
  const participants = (matchId: number) => members.filter((member) => member.matchId === matchId).map((member) => playerById.get(member.playerId)).filter((player): player is Player => Boolean(player));
  return <PageShell active="results">
    <header className="page-intro"><div><span className="eyebrow">MATCH ARCHIVE</span><h1>대전 결과</h1></div><p>최신 경기부터 점수와 MVP를 확인할 수 있는 증바람 내전 아카이브입니다.</p></header>
    {admin && <section className="result-entry-panel panel"><div className="result-section-heading"><div><span className="eyebrow">RESULT ENTRY</span><h2>대전 결과 등록</h2></div><p>예정 대전을 선택해 결과를 확정하면 선수 승패가 자동 반영됩니다.</p></div><div className="match-list">{scheduled.length ? scheduled.map((match) => <div className="scheduled-match manageable" key={match.id}><MatchCard match={match} /><div className="match-admin-actions"><details><summary>결과 등록</summary><ResultForm match={match} participants={participants(match.id)} submitLabel="결과 저장" /></details></div></div>) : <p className="empty">결과를 등록할 예정 대전이 없습니다.</p>}</div></section>}
    <div className="result-section-heading archive-heading"><div><span className="eyebrow">COMPLETED</span><h2>완료된 대전</h2></div><p>전체 {matchCounts.completed}개 · {page}/{totalPages} 페이지</p></div>
    <div className="match-list">{completed.length ? completed.map((match) => <div className={`completed-match${admin ? " manageable" : ""}`} key={match.id}><MatchCard match={match} />{admin && <div className="match-admin-actions"><details><summary>결과 수정</summary><ResultForm match={match} participants={participants(match.id)} submitLabel="수정 저장" /></details></div>}</div>) : <p className="empty panel">등록된 대전 결과가 없습니다.</p>}</div>
    {totalPages > 1 && <nav aria-label="대전 결과 페이지" className="pagination">{page > 1 ? <Link className="button ghost" href={`/results?page=${page - 1}`}>이전</Link> : <span />}{page < totalPages && <Link className="button ghost" href={`/results?page=${page + 1}`}>다음</Link>}</nav>}
  </PageShell>;
}
