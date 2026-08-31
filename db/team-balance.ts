export type BalancePlayer = {
  id: number;
  nickname: string;
  tier: number;
  wins: number;
  losses: number;
  points: number;
};

export type LinkedTelegramPlayer = BalancePlayer & { telegramUserId: number; active: boolean };

export function prepareTelegramTeams(votes: { telegramUserId: number; displayName: string; username: string | null }[], linkedPlayers: LinkedTelegramPlayer[]) {
  const playerByTelegramId = new Map(linkedPlayers.map((player) => [player.telegramUserId, player]));
  const invalidParticipants: string[] = [];
  const players: BalancePlayer[] = [];
  for (const vote of votes) {
    const player = playerByTelegramId.get(vote.telegramUserId);
    if (!player?.active || player.tier === 6) invalidParticipants.push(vote.username ? `${vote.displayName} (@${vote.username})` : vote.displayName);
    else players.push(player);
  }
  if (invalidParticipants.length || players.length !== 10 || new Set(players.map((player) => player.id)).size !== 10) return { ok: false as const, invalidParticipants: invalidParticipants.length ? invalidParticipants : votes.map((vote) => vote.displayName) };
  const { teamA, teamB, difference } = balanceTeams(players, []);
  return { ok: true as const, teamA, teamB, difference, teamAScore: teamA.reduce((total, player) => total + playerPower(player), 0), teamBScore: teamB.reduce((total, player) => total + playerPower(player), 0) };
}

export function playerPower(player: Pick<BalancePlayer, "tier" | "points">) {
  return (5 - player.tier) * 25 + player.points;
}

export function calculateTeamRankScores(members: { team: "A" | "B"; rankScore: number | null }[]) {
  const scores: Partial<Record<"A" | "B", number>> = {};
  for (const team of ["A", "B"] as const) {
    const teamMembers = members.filter((member) => member.team === team);
    if (teamMembers.length === 5 && teamMembers.every((member) => Number.isFinite(member.rankScore))) {
      scores[team] = teamMembers.reduce((total, member) => total + member.rankScore!, 0);
    }
  }
  return scores;
}

export function balanceTeams(players: BalancePlayer[], separatedGroups: number[][], previousTeamAIds: number[] = []) {
  if (players.length !== 10) throw new Error("정확히 10명을 선택해야 합니다.");
  if (new Set(players.map((player) => player.id)).size !== 10) throw new Error("선수가 중복되었습니다.");
  if (players.some((player) => player.tier === 6)) throw new Error("코치는 대전 참가자로 선택할 수 없습니다.");
  if (separatedGroups.some((group) => group.length > 2)) throw new Error("분리 그룹은 최대 2명까지 지정할 수 있습니다.");

  const indexById = new Map(players.map((player, index) => [player.id, index]));
  const constraints = separatedGroups
    .filter((group) => group.length === 2)
    .map(([a, b]) => [indexById.get(a), indexById.get(b)] as const);
  if (constraints.some(([a, b]) => a === undefined || b === undefined)) throw new Error("분리 그룹에 선택되지 않은 선수가 있습니다.");

  let bestMask = 0;
  let bestDifference = Number.POSITIVE_INFINITY;
  let fallbackMask = 0;
  let fallbackDifference = Number.POSITIVE_INFINITY;
  const previousTeamA = new Set(previousTeamAIds);
  for (let mask = 1; mask < 1 << players.length; mask += 2) {
    let count = 0;
    for (let index = 0; index < players.length; index++) count += (mask >> index) & 1;
    if (count !== 5 || constraints.some(([a, b]) => ((mask >> a!) & 1) === ((mask >> b!) & 1))) continue;

    const difference = Math.abs(players.reduce((total, player, index) => total + (((mask >> index) & 1) ? playerPower(player) : -playerPower(player)), 0));
    const samePartition = previousTeamA.size === 5 && (players.every((player, index) => Boolean((mask >> index) & 1) === previousTeamA.has(player.id)) || players.every((player, index) => Boolean((mask >> index) & 1) !== previousTeamA.has(player.id)));
    if (samePartition) {
      if (difference < fallbackDifference) { fallbackDifference = difference; fallbackMask = mask; }
      continue;
    }
    if (difference < bestDifference) {
      bestDifference = difference;
      bestMask = mask;
    }
  }
  if (!bestMask && fallbackMask) { bestMask = fallbackMask; bestDifference = fallbackDifference; }
  if (!bestMask) throw new Error("분리 조건을 만족하는 팀 조합이 없습니다.");

  return {
    teamA: players.filter((_, index) => (bestMask >> index) & 1),
    teamB: players.filter((_, index) => !((bestMask >> index) & 1)),
    difference: bestDifference,
  };
}
