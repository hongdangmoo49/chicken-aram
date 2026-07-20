import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlayerPositions } from "../lib/player-positions.ts";

test("validates preferred position combinations", () => {
  assert.deepEqual(normalizePlayerPositions(["탱커", "브루저", "탱커"]), ["탱커", "브루저"]);
  assert.deepEqual(normalizePlayerPositions(["올라운더"]), ["올라운더"]);
  assert.equal(normalizePlayerPositions(["올라운더", "탱커"]), null);
  assert.equal(normalizePlayerPositions(["탱커", "브루저", "메이지", "원딜"]), null);
  assert.equal(normalizePlayerPositions(["정글"]), null);
});
