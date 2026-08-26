import assert from "node:assert/strict";
import test from "node:test";
import { balanceTeams, calculateTeamRankScores, playerPower } from "../db/team-balance.ts";

test("uses persisted RP with 50-point tier gaps", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((tier) => playerPower({ tier, points: 0 })), [200, 150, 100, 50, 0]);
  assert.equal(playerPower({ tier: 3, points: 15 }), 115);
});

test("sums five complete player rank scores per team", () => {
  assert.deepEqual(calculateTeamRankScores([
    ...Array.from({ length: 5 }, () => ({ team: "A", rankScore: 10 })),
    ...Array.from({ length: 5 }, () => ({ team: "B", rankScore: 12 })),
  ]), { A: 50, B: 60 });
  assert.deepEqual(calculateTeamRankScores(Array.from({ length: 4 }, () => ({ team: "A", rankScore: 10 }))), {});
  assert.deepEqual(calculateTeamRankScores(Array.from({ length: 5 }, () => ({ team: "A", rankScore: null }))), {});
});

test("balances ten players while separating a requested pair", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, nickname: `P${index + 1}`, tier: (index % 5) + 1, wins: 10, losses: 10, points: 0 }));
  const result = balanceTeams(players, [[1, 2]]);
  assert.equal(result.teamA.length, 5);
  assert.equal(result.teamB.length, 5);
  assert.notEqual(result.teamA.some((player) => player.id === 1), result.teamA.some((player) => player.id === 2));
  const rebalanced = balanceTeams(players, [[1, 2]], result.teamA.map((player) => player.id));
  assert.notDeepEqual(new Set(rebalanced.teamA.map((player) => player.id)), new Set(result.teamA.map((player) => player.id)));
});

test("keeps coaches out of playable team assignments", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, nickname: `P${index + 1}`, tier: index === 9 ? 6 : 5, wins: 0, losses: 0, points: 0 }));
  assert.throws(() => balanceTeams(players, []), /코치는 대전 참가자로 선택할 수 없습니다/);
});
