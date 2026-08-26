import assert from "node:assert/strict";
import test from "node:test";
import { adjustRankPointsForTierChange, needsSuperAdminRankReview, normalizeTierChanges, playerTierLabel } from "../lib/player-tiers.ts";

test("validates and deduplicates batch tier changes", () => {
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 2, order: 0 }, { playerId: 1, tier: 3, order: 2 }]), [{ playerId: 1, tier: 3, order: 2 }]);
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 5, order: 0 }]), [{ playerId: 1, tier: 5, order: 0 }]);
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 6, order: 0 }]), [{ playerId: 1, tier: 6, order: 0 }]);
  assert.deepEqual(normalizeTierChanges([{ playerId: 1, tier: 2, order: 0, points: -12 }]), [{ playerId: 1, tier: 2, order: 0, points: -12 }]);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 2, order: 0, points: 1.5 }]), null);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 7, order: 0 }]), null);
  assert.equal(normalizeTierChanges([{ playerId: 1, tier: 2, order: -1 }]), null);
  assert.equal(normalizeTierChanges([]), null);
  assert.equal(playerTierLabel(5), "T5");
  assert.equal(playerTierLabel(6), "코치");
  assert.equal(playerTierLabel(1), "T1");
});

test("adjusts RP for manual admin tier moves without automatic progression", () => {
  assert.equal(adjustRankPointsForTierChange(0, 3, 1), -50);
  assert.equal(adjustRankPointsForTierChange(0, 3, 5), 30);
  assert.equal(needsSuperAdminRankReview(1, -50), true);
  assert.equal(needsSuperAdminRankReview(1, 30), false);
  assert.equal(needsSuperAdminRankReview(5, -30), false);
});
