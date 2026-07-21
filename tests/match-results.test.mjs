import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMatchResult } from "../lib/match-results.ts";

test("validates match result fields and winner", () => {
  assert.deepEqual(normalizeMatchResult({ playedAt: "2026-07-21T20:30", aScore: "2", bScore: "1", winner: "A", mvpPlayerId: "7" }), { playedAt: "2026-07-21T11:30:00.000Z", aScore: 2, bScore: 1, winner: "A", mvpPlayerId: 7 });
  assert.equal(normalizeMatchResult({ playedAt: "2026-07-21T20:30", aScore: "1", bScore: "2", winner: "A", mvpPlayerId: "7" }), null);
  assert.equal(normalizeMatchResult({ playedAt: "2026-07-21T20:30", aScore: "1", bScore: "1", winner: "A", mvpPlayerId: "7" }), null);
  assert.equal(normalizeMatchResult({ playedAt: "2026-02-31T20:30", aScore: "2", bScore: "1", winner: "A", mvpPlayerId: "7" }), null);
});
