import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoundRecord } from "../lib/player-records.ts";

test("separates round scores from match records", () => {
  assert.deepEqual(calculateRoundRecord([{ team: "A", aScore: 3, bScore: 2 }, { team: "B", aScore: 0, bScore: 3 }]), { roundWins: 6, roundLosses: 2 });
});
