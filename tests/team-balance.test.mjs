import assert from "node:assert/strict";
import test from "node:test";
import { balanceTeams } from "../db/team-balance.ts";

test("balances ten players while separating a requested pair", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, nickname: `P${index + 1}`, tier: (index % 4) + 1, wins: 10, losses: 10 }));
  const result = balanceTeams(players, [[1, 2]]);
  assert.equal(result.teamA.length, 5);
  assert.equal(result.teamB.length, 5);
  assert.notEqual(result.teamA.some((player) => player.id === 1), result.teamA.some((player) => player.id === 2));
  const rebalanced = balanceTeams(players, [[1, 2]], result.teamA.map((player) => player.id));
  assert.notDeepEqual(new Set(rebalanced.teamA.map((player) => player.id)), new Set(result.teamA.map((player) => player.id)));
});
