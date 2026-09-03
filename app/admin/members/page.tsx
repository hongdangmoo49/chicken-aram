import Link from "next/link";
import { redirect } from "next/navigation";
import { withToast } from "../../../lib/toast";
import { requireCurrentUser } from "../../auth";
import { getMembers, getPendingMvpMatches, type PendingMvpMatch } from "../../roles";
import { PageShell } from "../../ui";
import { MemberRoleEditor } from "./member-role-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "멤버 관리" };

function playedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function PendingMvpPanel({ matches }: { matches: PendingMvpMatch[] }) {
  return <section className="pending-mvp-panel panel">
    <div className="member-heading"><div><span className="eyebrow">MVP CONTROL</span><h2>미완료 MVP 투표</h2></div><p>투표가 끝나지 않은 팀의 MVP를 직접 확정할 수 있습니다. 확정 즉시 RP 1점이 지급되며 해당 팀 투표가 종료됩니다.</p></div>
    {matches.length ? <div className="pending-mvp-list">{matches.map((match) => <article className="pending-mvp-match" key={match.id}>
      <header><div><strong>{playedAt(match.playedAt)} · {match.map}</strong><span>경기 #{match.id}</span></div><b>A팀 {match.aScore} : {match.bScore} B팀</b></header>
      <div>{match.contests.map((contest) => <form action="/api/admin/mvp" className="pending-mvp-form" key={contest.team} method="post">
        <input name="matchId" type="hidden" value={match.id} />
        <label htmlFor={`mvp-${match.id}-${contest.team}`}><strong>{contest.team}팀 MVP</strong><span>{contest.round}라운드 · {contest.votesCast}/5명 투표</span></label>
        <select defaultValue="" id={`mvp-${match.id}-${contest.team}`} name="playerId" required><option disabled value="">선수 선택</option>{contest.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nickname}</option>)}</select>
        <button className="button primary" type="submit">MVP 확정 · RP +1</button>
        <div className="pending-mvp-votes"><strong>현재 투표 내용</strong>{contest.votes.length ? <div>{contest.votes.map((vote) => <span key={vote.voterId}>{vote.voterNickname} <b>→ {vote.candidateNickname}</b></span>)}</div> : <p>아직 투표한 선수가 없습니다.</p>}<p className="pending-mvp-missing"><b>미투표</b> · {contest.missingVoters.length ? contest.missingVoters.map((voter) => voter.nickname).join(" · ") : "없음"}</p></div>
      </form>)}</div>
    </article>)}</div> : <p className="member-empty">MVP 투표가 미완료된 경기가 없습니다.</p>}
  </section>;
}

export default async function MembersPage() {
  const user = await requireCurrentUser("/admin/members");
  const role = user.role;
  if (role === "user") redirect(withToast("/profile", "error", "관리자 권한이 필요합니다."));

  const canManageRoles = role === "super_admin";
  const [members, pendingMvpMatches] = await Promise.all([
    getMembers(canManageRoles),
    canManageRoles ? getPendingMvpMatches() : Promise.resolve([]),
  ]);

  return <PageShell active="admin">
    <header className="page-intro"><div><span className="eyebrow">MEMBER ACCESS</span><h1>멤버 관리</h1></div><p>{canManageRoles ? "가입 이메일을 확인하고 권한과 로그인 계정을 관리할 수 있습니다." : "가입한 멤버와 현재 권한을 확인할 수 있습니다. 권한 변경은 슈퍼 관리자만 할 수 있습니다."}</p></header>
    <nav className="admin-subnav"><Link className="button ghost" href="/admin/audit">변경 기록</Link></nav>
    {canManageRoles && <PendingMvpPanel matches={pendingMvpMatches} />}
    <section className="member-panel panel">
      <div className="member-heading"><div><span className="eyebrow">ACCESS LEVEL</span><h2>멤버 권한 관리</h2></div><p>슈퍼 관리자 · 관리자 · 일반 사용자 권한을 구분해 표시합니다.</p></div>
      <MemberRoleEditor canManageRoles={canManageRoles} currentUserId={user.id} members={members} />
    </section>
  </PageShell>;
}
