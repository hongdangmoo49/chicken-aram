import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeamPlayers } from "../lib/team-players.ts";

test("accepts two unique five-player teams", () => {
  assert.deepEqual(normalizeTeamPlayers([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]), { teamAIds: [1, 2, 3, 4, 5], teamBIds: [6, 7, 8, 9, 10] });
  assert.equal(normalizeTeamPlayers([1, 2, 3, 4, 5], [5, 7, 8, 9, 10]), null);
});
