import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMemberRoleChanges } from "../lib/member-roles.ts";

const firstUser = "6afaecb4-67ed-4191-82da-2b8866d59552";
const secondUser = "7f0b931f-d149-4494-9af0-693fa5b4dea4";

test("validates and deduplicates batch member role changes", () => {
  assert.deepEqual(normalizeMemberRoleChanges([{ userId: firstUser, role: "user" }, { userId: firstUser, role: "admin" }, { userId: secondUser, role: "user" }]), [{ userId: firstUser, role: "admin" }, { userId: secondUser, role: "user" }]);
  assert.equal(normalizeMemberRoleChanges([{ userId: firstUser, role: "super_admin" }]), null);
  assert.equal(normalizeMemberRoleChanges([{ userId: "not-a-uuid", role: "admin" }]), null);
  assert.equal(normalizeMemberRoleChanges([]), null);
});
