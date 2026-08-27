export type MvpVote = { round: number; candidatePlayerId: number };

export function currentMvpRound(votes: MvpVote[]) {
  const latestRound = Math.max(0, ...votes.map((vote) => vote.round));
  if (!latestRound) return 1;
  return votes.filter((vote) => vote.round === latestRound).length === 5 ? latestRound + 1 : latestRound;
}

export function topMvpCandidateIds(votes: Pick<MvpVote, "candidatePlayerId">[]) {
  const counts = new Map<number, number>();
  for (const vote of votes) counts.set(vote.candidatePlayerId, (counts.get(vote.candidatePlayerId) ?? 0) + 1);
  const topVotes = Math.max(0, ...counts.values());
  return new Set([...counts].filter(([, count]) => count === topVotes).map(([id]) => id));
}
