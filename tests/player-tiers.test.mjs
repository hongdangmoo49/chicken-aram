import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTierChanges } from "../lib/player-tiers.ts";

test("validates and deduplicates batch tier changes", () => {
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 2 }, { playerId: 1, tier: 3 }]), [{ playerId: 1, tier: 3 }]);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 5 }]), null);
  assert.equal(normalizeTierChanges([]), null);
});
