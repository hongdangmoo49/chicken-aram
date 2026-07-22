export type PlayerRoundResult = { team: "A" | "B"; aScore: number; bScore: number };

export function calculateRoundRecord(results: PlayerRoundResult[]) {
  return results.reduce((record, result) => ({
    roundWins: record.roundWins + (result.team === "A" ? result.aScore : result.bScore),
    roundLosses: record.roundLosses + (result.team === "A" ? result.bScore : result.aScore),
  }), { roundWins: 0, roundLosses: 0 });
}
