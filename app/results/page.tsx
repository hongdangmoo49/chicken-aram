import { getMatches } from "../../db/site-data";
import { MatchCard, PageShell } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "대전 결과" };

export default async function ResultsPage() {
  const matches = (await getMatches()).filter((match) => match.status === "completed");
  return <PageShell active="results">
    <header className="page-intro"><div><span className="eyebrow">MATCH ARCHIVE</span><h1>대전 결과</h1></div><p>최신 경기부터 점수와 MVP를 확인할 수 있는 증바람 내전 아카이브입니다.</p></header>
    <div className="match-list">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>
  </PageShell>;
}
