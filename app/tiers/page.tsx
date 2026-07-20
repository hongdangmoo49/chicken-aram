import { getPlayers } from "../../db/site-data";
import { PageShell, PlayerAvatar, PlayerPositions } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "선수 티어표" };

export default async function TiersPage() {
  const players = await getPlayers();
  const rate = (wins: number, losses: number) => wins + losses === 0 ? 0 : Math.round((wins / (wins + losses)) * 100);
  return <PageShell active="tiers">
    <header className="page-intro"><div><span className="eyebrow">PLAYER POWER RANKING</span><h1>선수 티어표</h1></div><p>1~4티어로 구분하며, 같은 티어에서는 누적 승률이 높은 선수가 앞에 배치됩니다.</p></header>
    <div className="filter-row"><span className="filter-chip active">전체 선수 {players.length}</span><span className="filter-chip">승률 우선</span></div>
    <div className="tier-board">
      {[1,2,3,4].map((tier) => {
        const tierPlayers = players.filter((player) => player.tier === tier);
        return <section className={`tier-section tier-${tier}`} key={tier}><div className="tier-label"><div><strong>T{tier}</strong><span>{tierPlayers.length} PLAYERS</span></div></div><div className="tier-players">{tierPlayers.map((player) => <article className="tier-player-card" key={player.id}>
          <PlayerAvatar player={player} />
          <div className="tier-player-info"><strong>{player.nickname}</strong><span>{player.wins}승 {player.losses}패</span><PlayerPositions positions={player.positions} /></div>
          <div className="tier-player-rate"><strong>{rate(player.wins, player.losses)}%</strong><span>승률</span></div>
        </article>)}</div></section>;
      })}
    </div>
  </PageShell>;
}
