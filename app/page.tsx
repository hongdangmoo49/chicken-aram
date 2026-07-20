import Link from "next/link";
import { getMatches, getPlayers } from "../db/site-data";
import { MatchCard, PageShell, PlayerRow, SectionHeading } from "./ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [players, matches] = await Promise.all([getPlayers(), getMatches()]);
  const upcoming = matches.filter((match) => match.status === "scheduled");
  const recent = matches.filter((match) => match.status === "completed");
  const winRate = (player: (typeof players)[number]) =>
    player.wins + player.losses === 0
      ? 0
      : Math.round((player.wins / (player.wins + player.losses)) * 100);

  return (
    <PageShell active="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">CHICKEN ARAM · SEASON 01</span>
          <h1>ㅊㅈ? ㅊㅈ!</h1>
          <p>예정된 매치부터 결과, 선수 티어와 승률까지. 증강 칼바람 내전의 공식 기록실입니다.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/schedule">다음 대전 보기 <span>→</span></Link>
            <Link className="button ghost" href="/tiers">티어표 확인</Link>
          </div>
        </div>
        <div className="hero-visual">
          <img className="hero-image" src="/main-character.jpg" alt="치킨을 먹고 있는 포로 캐릭터" />
          <div className="hero-match">
            <div className="hero-match-top">
              <span className="live-dot" /> NEXT MATCH
              <span>{upcoming[0]?.map ?? "증강 칼바람 협곡"}</span>
            </div>
            {upcoming[0] ? <MatchCard match={upcoming[0]} featured /> : <p className="empty">예정된 대전이 없습니다.</p>}
          </div>
        </div>
      </section>

      <section className="stats-strip" aria-label="시즌 현황">
        <div><strong>{matches.length}</strong><span>전체 대전</span></div>
        <div><strong>{players.length}</strong><span>등록 선수</span></div>
        <div><strong>{recent.length}</strong><span>완료 대전</span></div>
        <div><strong>{upcoming.length}</strong><span>예정 대전</span></div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <SectionHeading kicker="POWER RANKING" title="현재 상위 선수" href="/tiers" />
          <div className="ranking-list">
            {players.slice(0, 5).map((player, index) => (
              <PlayerRow key={player.id} player={player} rank={index + 1} winRate={winRate(player)} />
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading kicker="RECENT MATCHES" title="최근 대전 결과" href="/results" />
          <div className="compact-matches">
            {recent.slice(0, 3).map((match) => <MatchCard key={match.id} match={match} compact />)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
