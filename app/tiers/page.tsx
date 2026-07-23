import { getPlayers } from "../../db/site-data";
import { getCurrentUser } from "../auth";
import { isAdmin } from "../roles";
import { PageShell } from "../ui";
import { TierDragBoard } from "./tier-drag-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "선수 티어표" };

export default async function TiersPage() {
  const [players, user] = await Promise.all([getPlayers(), getCurrentUser()]);
  const admin = user ? await isAdmin(user.id) : false;
  return <PageShell active="tiers">
    <header className="page-intro"><div><span className="eyebrow">PLAYER POWER RANKING</span><h1>선수 티어표</h1></div><p>1~4티어와 코치로 구분하며, 같은 티어에서는 누적 승률이 높은 선수가 앞에 배치됩니다.</p></header>
    <div className="filter-row"><span className="filter-chip active">전체 선수 {players.length}</span><span className="filter-chip">승률 우선</span></div>
    {admin && <div className="tier-drag-guide"><strong>관리자 편집 모드</strong><span>먼저 선수를 드래그해 배치한 뒤, 상단의 변경사항 저장을 눌러 한 번에 반영하세요.</span></div>}
    <TierDragBoard admin={admin} players={players} />
  </PageShell>;
}
