import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoundRecord, formatRecentMatchRecord } from "../lib/player-records.ts";

test("separates round scores from match records", () => {
  assert.deepEqual(calculateRoundRecord([{ team: "A", aScore: 3, bScore: 2 }, { team: "B", aScore: 0, bScore: 3 }]), { roundWins: 6, roundLosses: 2 });
});

test("formats the latest five match results and pads missing games", () => {
  const results = [
    { team: "A", winner: "A", playedAt: "2026-07-01T12:00:00Z" },
    { team: "B", winner: "A", playedAt: "2026-07-02T12:00:00Z" },
    { team: "A", winner: "B", playedAt: "2026-07-03T12:00:00Z" },
    { team: "B", winner: "B", playedAt: "2026-07-04T12:00:00Z" },
    { team: "A", winner: "A", playedAt: "2026-07-05T12:00:00Z" },
  ];
  assert.equal(formatRecentMatchRecord(results), "승승패패승");
  assert.equal(formatRecentMatchRecord(results.slice(2)), "승승패NN");
});
