import assert from "node:assert/strict";
import test from "node:test";
import { participantSelectionDisabled } from "../lib/participant-selection.ts";

test("blocks only additional participants after ten selections", () => {
  assert.equal(participantSelectionDisabled(9, false), false);
  assert.equal(participantSelectionDisabled(10, false), true);
  assert.equal(participantSelectionDisabled(10, true), false);
});
