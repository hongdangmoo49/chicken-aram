import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlayerComparison, getPlayers } from "../../../db/site-data";
import { playerTierLabel } from "../../../lib/player-tiers";
import { withToast } from "../../../lib/toast";
import { requireCurrentUser } from "../../auth";
import { PageShell, PlayerAvatar, PlayerPositions } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "선수 상대 전적" };

const rate = (wins: number, losses: number) => wins + losses ? Math.round(wins / (wins + losses) * 100) : 0;

export default async function PlayerComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId) || playerId < 1) notFound();
  const user = await requireCurrentUser(`/players/${playerId}`);
  if (user.role === "user") redirect(withToast("/tiers", "error", "관리자 권한이 필요합니다."));
  const [players, comparison] = await Promise.all([getPlayers(), getPlayerComparison(user.id, playerId)]);
  const player = players.find((entry) => entry.id === playerId);
  if (!player || !comparison) notFound();
  if (comparison.viewerPlayerId === playerId) redirect("/profile");

  return <PageShell active="tiers">
    <header className="page-intro"><div><span className="eyebrow">PLAYER MATCHUP</span><h1>{player.nickname}</h1></div><p>나와 함께했을 때와 상대팀으로 만났을 때의 완료 경기 전적입니다.</p></header>
    <Link className="button ghost player-detail-back" href="/tiers">← 티어표로 돌아가기</Link>
    <section className="player-detail-card panel">
      <div className="player-detail-identity"><PlayerAvatar large player={player} /><div><span className={`tier-pill tier-badge-${player.tier}`}>{playerTierLabel(player.tier)}</span><h2>{player.nickname}</h2><p>전체 전적 {player.wins}승 {player.losses}패 · RP {player.points}점</p><PlayerPositions positions={player.positions} /></div></div>
      <div className="player-comparison-grid">
        <article><span>같은 팀으로 경기</span><strong>{comparison.sameTeam.wins}승 {comparison.sameTeam.losses}패</strong><b>승률 {rate(comparison.sameTeam.wins, comparison.sameTeam.losses)}%</b></article>
        <article><span>상대팀으로 경기</span><strong>{comparison.opponent.wins}승 {comparison.opponent.losses}패</strong><b>내 기준 승률 {rate(comparison.opponent.wins, comparison.opponent.losses)}%</b></article>
      </div>
    </section>
  </PageShell>;
}
