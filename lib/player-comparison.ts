export type ComparisonParticipation = { matchId: number; playerId: number; team: "A" | "B"; winner: "A" | "B" | null };
export type ComparisonRecord = { wins: number; losses: number };

export function calculatePlayerComparison(viewerPlayerId: number, targetPlayerId: number, participations: ComparisonParticipation[]) {
  const sameTeam: ComparisonRecord = { wins: 0, losses: 0 };
  const opponent: ComparisonRecord = { wins: 0, losses: 0 };
  const byMatch = new Map<number, ComparisonParticipation[]>();
  for (const participation of participations) byMatch.set(participation.matchId, [...(byMatch.get(participation.matchId) ?? []), participation]);

  for (const match of byMatch.values()) {
    const viewer = match.find((entry) => entry.playerId === viewerPlayerId);
    const target = match.find((entry) => entry.playerId === targetPlayerId);
    if (!viewer || !target || !viewer.winner) continue;
    const record = viewer.team === target.team ? sameTeam : opponent;
    if (viewer.team === viewer.winner) record.wins += 1;
    else record.losses += 1;
  }
  return { sameTeam, opponent };
}
