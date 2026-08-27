"use client";

import { useCallback, useEffect, useState } from "react";
import type { MvpVotingContest } from "../../db/site-data";
import { PlayerAvatar } from "../player-ui";
import { useSession } from "../session-ui";

export function MvpVotingPanel() {
  const { loading, user } = useSession();
  const [contests, setContests] = useState<MvpVotingContest[]>([]);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/mvp-votes", { cache: "no-store" });
    if (!response.ok) return setMessage("MVP 투표를 불러오지 못했습니다.");
    const body = await response.json() as { contests: MvpVotingContest[] };
    setContests(body.contests);
    setSelections(Object.fromEntries(body.contests.flatMap((contest) => contest.selectedCandidateId ? [[contest.matchId, contest.selectedCandidateId]] : [])));
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const controller = new AbortController();
    fetch("/api/mvp-votes", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ contests: MvpVotingContest[] }> : null)
      .then((body) => {
        if (!body) return setMessage("MVP 투표를 불러오지 못했습니다.");
        setContests(body.contests);
        setSelections(Object.fromEntries(body.contests.flatMap((contest) => contest.selectedCandidateId ? [[contest.matchId, contest.selectedCandidateId]] : [])));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("MVP 투표를 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [loading, user]);

  async function submitVote(matchId: number) {
    const candidatePlayerId = selections[matchId];
    if (!candidatePlayerId) return setMessage("MVP 후보를 선택해 주세요.");
    setSavingMatchId(matchId);
    const response = await fetch(`/api/mvp-votes/${matchId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidatePlayerId }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "MVP 투표를 저장하지 못했습니다.");
    else { setMessage("MVP 투표를 저장했습니다."); await load(); }
    setSavingMatchId(null);
  }

  if (loading || !user || !contests.length) return null;
  return <section className="mvp-voting-section panel">
    <div className="result-section-heading"><div><span className="eyebrow">OPPONENT MVP VOTE</span><h2>내 MVP 투표</h2></div><p>상대팀 선수 중 가장 인상적이었던 선수를 선택해 주세요. 투표 내용은 공개되지 않습니다.</p></div>
    <div className="mvp-contest-list">{contests.map((contest) => <article className="mvp-contest" key={contest.matchId}>
      <header><div><strong>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(contest.playedAt))} · {contest.map}</strong><span>{contest.candidateTeam}팀 MVP {contest.runoff ? `재투표 ${contest.round}라운드` : "투표"}</span></div><b>{contest.votesCast}/5명 완료</b></header>
      <div className="mvp-candidates">{contest.candidates.map((candidate) => <label className={selections[contest.matchId] === candidate.id ? "selected" : ""} key={candidate.id}><input checked={selections[contest.matchId] === candidate.id} name={`mvp-${contest.matchId}`} onChange={() => setSelections((current) => ({ ...current, [contest.matchId]: candidate.id }))} type="radio" /><PlayerAvatar player={candidate} /><span>{candidate.nickname}</span></label>)}</div>
      <button className="button primary" disabled={!selections[contest.matchId] || savingMatchId === contest.matchId} onClick={() => void submitVote(contest.matchId)} type="button">{savingMatchId === contest.matchId ? "저장 중..." : contest.selectedCandidateId ? "투표 변경" : "투표 저장"}</button>
    </article>)}</div>
    <p aria-live="polite" className="mvp-vote-message">{message}</p>
  </section>;
}
