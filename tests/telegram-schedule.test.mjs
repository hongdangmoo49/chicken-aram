import assert from "node:assert/strict";
import test from "node:test";
import { prepareTelegramTeams } from "../db/team-balance.ts";

const votes = Array.from({ length: 10 }, (_, index) => ({ telegramUserId: index + 1, displayName: `U${index + 1}`, username: `u${index + 1}` }));
const players = Array.from({ length: 10 }, (_, index) => ({ telegramUserId: index + 1, id: index + 1, nickname: `P${index + 1}`, tier: index % 5 + 1, wins: 0, losses: 0, points: index, active: true }));

test("prepares balanced teams only when all Telegram voters have playable accounts", () => {
  const ready = prepareTelegramTeams(votes, players);
  assert.equal(ready.ok, true);
  if (ready.ok) {
    assert.equal(ready.teamA.length, 5);
    assert.equal(ready.teamB.length, 5);
    assert.equal(ready.teamAScore - ready.teamBScore, ready.teamA.reduce((sum, player) => sum + (5 - player.tier) * 25 + player.points, 0) - ready.teamB.reduce((sum, player) => sum + (5 - player.tier) * 25 + player.points, 0));
  }
  const missing = prepareTelegramTeams(votes, players.slice(0, 9));
  assert.deepEqual(missing, { ok: false, invalidParticipants: ["U10 (@u10)"] });
  const coach = prepareTelegramTeams(votes, players.map((player, index) => index === 9 ? { ...player, tier: 6 } : player));
  assert.deepEqual(coach, { ok: false, invalidParticipants: ["U10 (@u10)"] });
});
