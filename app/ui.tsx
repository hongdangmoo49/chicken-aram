import Link from "next/link";
import type { Match, Player } from "../db/site-data";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { isAdmin } from "./roles";

const nav = [
  ["home", "/", "홈"],
  ["tiers", "/tiers", "선수 티어"],
  ["schedule", "/schedule", "대전 예정"],
  ["results", "/results", "대전 결과"],
] as const;

export async function PageShell({ active, children }: { active: string; children: React.ReactNode }) {
  const user = await getChatGPTUser();
  const admin = user ? isAdmin(user.email) : false;
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">ㅊ</span><span>치킨 <em>증바람</em></span></Link>
        <nav className="main-nav" aria-label="주 메뉴">
          {nav.map(([key, href, label]) => <Link className={active === key ? "active" : ""} href={href} key={key}>{label}</Link>)}
        </nav>
        <div className="account">
          {user && <div className="account-copy"><strong>{user.displayName}</strong><span>{admin ? "관리자" : "일반 계정"}</span></div>}
          <Link className="account-link" href={user ? chatGPTSignOutPath() : chatGPTSignInPath("/")}>{user ? "로그아웃" : "로그인"}</Link>
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
  return <div className="player-row"><span className="rank">{String(rank).padStart(2, "0")}</span><span className="player-name"><span className="avatar">{player.nickname.slice(0, 1)}</span>{player.nickname}</span><span className="tier-pill">T{player.tier}</span><span className="win-rate">{winRate}%</span></div>;
}

export function MatchCard({ match, featured = false, compact = false }: { match: Match; featured?: boolean; compact?: boolean }) {
  const completed = match.status === "completed";
  const date = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(match.scheduledAt));
  return (
    <article className={`match-card${featured ? " featured" : ""}${compact ? " compact" : ""}`}>
      <div className="match-meta"><span>{date}</span><span>{match.map}</span></div>
      <div className="match-teams">
        <div className="team red"><small>RED TEAM</small><strong>{match.teamRed}</strong></div>
        <div className="versus">{completed ? <span className="score">{match.redScore}:{match.blueScore}</span> : "VS"}</div>
        <div className="team blue"><small>BLUE TEAM</small><strong>{match.teamBlue}</strong></div>
      </div>
      {!compact && <div className="match-footer"><span className="status">{completed ? "경기 종료" : "참가자 모집 중"}</span><span>{completed && match.mvp ? `MVP · ${match.mvp}` : "5 vs 5 · BO1"}</span></div>}
    </article>
  );
}
