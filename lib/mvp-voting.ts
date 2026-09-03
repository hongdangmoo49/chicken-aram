export type MvpVote = { round: number; candidatePlayerId: number };
export type TelegramMvpMember = { playerId: number; team: "A" | "B"; nickname: string };
export type TelegramMvpContest = { candidateTeam: "A" | "B"; round: number; votesCast: number; candidates: { id: number; nickname: string }[]; winner: { id: number; nickname: string } | null };

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

export function missingMvpVoters(members: TelegramMvpMember[], candidateTeam: "A" | "B", voterIds: number[]) {
  const voted = new Set(voterIds);
  return members
    .filter((member) => member.team !== candidateTeam && !voted.has(member.playerId))
    .map((member) => ({ id: member.playerId, nickname: member.nickname }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
}

export function buildTelegramMvpContests(members: TelegramMvpMember[], votes: { candidateTeam: "A" | "B"; round: number; candidatePlayerId: number }[], awards: { team: "A" | "B"; playerId: number; nickname: string }[]): TelegramMvpContest[] {
  return (["A", "B"] as const).map((candidateTeam) => {
    const award = awards.find((item) => item.team === candidateTeam);
    if (award) return { candidateTeam, round: 1, votesCast: 5, candidates: [], winner: { id: award.playerId, nickname: award.nickname } };
    const contestVotes = votes.filter((vote) => vote.candidateTeam === candidateTeam);
    const round = currentMvpRound(contestVotes);
    let candidates = members.filter((member) => member.team === candidateTeam).map((member) => ({ id: member.playerId, nickname: member.nickname }));
    if (round > 1) {
      const finalistIds = topMvpCandidateIds(contestVotes.filter((vote) => vote.round === round - 1));
      candidates = candidates.filter((candidate) => finalistIds.has(candidate.id));
    }
    return { candidateTeam, round, votesCast: contestVotes.filter((vote) => vote.round === round).length, candidates, winner: null };
  });
}
