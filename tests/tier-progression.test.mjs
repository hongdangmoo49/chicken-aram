import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202608260025_add_rank_progression.sql", import.meta.url);

test("persists RP and applies automatic promotion and demotion only on record changes", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /add column rank_points integer not null default 0/);
  assert.match(migration, /rank_points = \(wins - losses\) \* 3/);
  assert.equal((8 - 3) * 3, 15);
  assert.match(migration, /new\.rank_points > 25/);
  assert.match(migration, /new\.rank_points := new\.rank_points - 25/);
  assert.match(migration, /new\.rank_points <= -15/);
  assert.match(migration, /new\.rank_points := new\.rank_points \+ 15/);
  assert.match(migration, /new\.wins = old\.wins and new\.losses = old\.losses/);
  assert.match(migration, /before update of wins, losses/);
  assert.match(migration, /actor_role = 'super_admin'.*change\.value \? 'points'/s);
  assert.match(migration, /actor_role = 'admin'.*\* 25/s);
  assert.match(migration, /actor_role = 'admin'.*\* 15/s);
});
