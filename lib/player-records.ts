export type PlayerRoundResult = { team: "A" | "B"; aScore: number; bScore: number };
export type PlayerMatchResult = { team: "A" | "B"; winner: "A" | "B"; playedAt: string };

export function calculateRoundRecord(results: PlayerRoundResult[]) {
  return results.reduce((record, result) => ({
    roundWins: record.roundWins + (result.team === "A" ? result.aScore : result.bScore),
    roundLosses: record.roundLosses + (result.team === "A" ? result.bScore : result.aScore),
  }), { roundWins: 0, roundLosses: 0 });
}

export function formatRecentMatchRecord(results: PlayerMatchResult[]) {
  return [...results]
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    .slice(0, 5)
    .map((result) => result.team === result.winner ? "승" : "패")
    .join("")
    .padEnd(5, "N");
}
