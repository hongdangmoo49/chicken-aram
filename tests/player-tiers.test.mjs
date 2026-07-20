import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTierChanges } from "../lib/player-tiers.ts";

test("validates and deduplicates batch tier changes", () => {
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 2, order: 0 }, { playerId: 1, tier: 3, order: 2 }]), [{ playerId: 1, tier: 3, order: 2 }]);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 5, order: 0 }]), null);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 2, order: -1 }]), null);
  assert.equal(normalizeTierChanges([]), null);
});
