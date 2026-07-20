import Link from "next/link";
import type { Match, Player } from "../db/site-data";
import { getCurrentUser } from "./auth";
import { signOut } from "./auth/actions";
import { PlayerAvatar, PlayerPositions } from "./player-ui";
import { getRole, roleLabels } from "./roles";

export { PlayerAvatar, PlayerPositions } from "./player-ui";

const nav = [
  ["home", "/", "홈"],
  ["tiers", "/tiers", "선수 티어"],
  ["schedule", "/schedule", "대전 예정"],
  ["results", "/results", "대전 결과"],
  ["profile", "/profile", "내 프로필"],
] as const;

export async function PageShell({ active, children }: { active: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  const role = user ? await getRole(user.id) : null;
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">ㅊ</span><span>치킨 <em>증바람</em></span></Link>
        <nav className="main-nav" aria-label="주 메뉴">
          {nav.map(([key, href, label]) => <Link className={active === key ? "active" : ""} href={href} key={key}>{label}</Link>)}
        </nav>
        <div className="account">
          {user && role && <div className="account-profile"><PlayerAvatar player={{ nickname: user.displayName, thumbnailKey: user.thumbnailKey }} /><div className="account-copy"><strong>{user.displayName}</strong><span>{roleLabels[role]}</span></div></div>}
          {user && role !== "user" && <Link className="admin-access-link" href="/admin/members">멤버 관리</Link>}
          {user ? <form action={signOut}><button className="account-link" type="submit">로그아웃</button></form> : <Link className="account-link" href="/login">로그인</Link>}
        </div>
      </header>
      <main className="page-wrap">{children}</main>
    </>
  );
}

export function SectionHeading({ kicker, title, href }: { kicker: string; title: string; href: string }) {
  return <div className="section-heading"><div><p>{kicker}</p><h2>{title}</h2></div><Link href={href}>전체 보기 →</Link></div>;
}

export function PlayerRow({ player, rank, winRate }: { player: Player; rank: number; winRate: number }) {
  return <div className="player-row"><span className="rank">{String(rank).padStart(2, "0")}</span><span className="player-name"><PlayerAvatar player={player} />{player.nickname}</span><span className="player-tags"><span className="tier-pill">T{player.tier}</span><PlayerPositions positions={player.positions} /></span><span className="win-rate">{winRate}%</span></div>;
}

export function MatchCard({ match, featured = false, compact = false }: { match: Match; featured?: boolean; compact?: boolean }) {
  const completed = match.status === "completed";
  const date = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(match.scheduledAt));
  return (
    <article className={`match-card${featured ? " featured" : ""}${compact ? " compact" : ""}`}>
      <div className="match-meta"><span>{date}</span><span>{match.map}</span></div>
      <div className="match-teams">
        <div className="team red"><small>A TEAM</small><strong>A팀</strong><span className="team-members">{match.teamRed}</span></div>
        <div className="versus">{completed ? <span className="score">{match.redScore}:{match.blueScore}</span> : "VS"}</div>
        <div className="team blue"><small>B TEAM</small><strong>B팀</strong><span className="team-members">{match.teamBlue}</span></div>
      </div>
      {!compact && <div className="match-footer"><span className="status">{completed ? "경기 종료" : "팀 배정 완료"}</span><span>{completed && match.mvp ? `MVP · ${match.mvp}` : "5 vs 5 · BO1"}</span></div>}
    </article>
  );
}
