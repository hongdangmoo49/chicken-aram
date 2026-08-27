import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculatePlayerComparison } from "../lib/player-comparison.ts";

test("calculates same-team and opposing records from the viewer perspective", () => {
  const rows = [
    { matchId: 1, playerId: 10, team: "A", winner: "A" }, { matchId: 1, playerId: 20, team: "A", winner: "A" },
    { matchId: 2, playerId: 10, team: "B", winner: "A" }, { matchId: 2, playerId: 20, team: "B", winner: "A" },
    { matchId: 3, playerId: 10, team: "A", winner: "A" }, { matchId: 3, playerId: 20, team: "B", winner: "A" },
    { matchId: 4, playerId: 10, team: "B", winner: "A" }, { matchId: 4, playerId: 20, team: "A", winner: "A" },
    { matchId: 5, playerId: 10, team: "A", winner: "A" },
  ];
  assert.deepEqual(calculatePlayerComparison(10, 20, rows), { sameTeam: { wins: 1, losses: 1 }, opponent: { wins: 1, losses: 1 } });
});

test("links tier cards to comparison pages and redirects self to profile", async () => {
  const [board, page] = await Promise.all([
    readFile(new URL("../app/tiers/tier-drag-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/players/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(board, /href=\{`\/players\/\$\{player\.id\}`\}/);
  assert.match(board, /admin \? <Link/);
  assert.match(page, /user\.role === "user".*관리자 권한이 필요합니다/s);
  assert.match(page, /comparison\.viewerPlayerId === playerId.*redirect\("\/profile"\)/s);
  assert.match(page, /같은 팀으로 경기/);
  assert.match(page, /상대팀으로 경기/);
});
