import { getPlayers } from "../../db/site-data";
import { AdminOnly } from "../session-ui";
import { PageShell } from "../ui";
import { TierDragBoard } from "./tier-drag-board";

export const revalidate = 300;
export const metadata = { title: "선수 티어표" };

export default async function TiersPage() {
  const players = await getPlayers();
  return <PageShell active="tiers">
    <header className="page-intro"><div><span className="eyebrow">PLAYER POWER RANKING</span><h1>선수 티어표</h1></div><p>1~5티어와 코치로 구분하며, 같은 티어에서는 승리 +3점·패배 -1점 합계가 높은 선수가 앞에 배치됩니다.</p></header>
    <div className="filter-row"><span className="filter-chip active">전체 선수 {players.length}</span><span className="filter-chip">티어 점수 우선</span></div>
    <AdminOnly><div className="tier-drag-guide"><strong>관리자 편집 모드</strong><span>선수를 원하는 티어로 옮기면 티어 내부 순서는 점수에 따라 자동 배치됩니다.</span></div></AdminOnly>
    <TierDragBoard players={players} />
  </PageShell>;
}
