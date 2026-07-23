import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("creates schedules and participants in one database transaction", async () => {
  const [siteData, migration] = await Promise.all([
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607230017_create_schedule_transaction.sql", root), "utf8"),
  ]);
  assert.match(siteData, /rpc\("create_balanced_schedule"/);
  assert.doesNotMatch(siteData, /await admin\.from\("matches"\)\.delete/);
  assert.match(migration, /insert into public\.matches/);
  assert.match(migration, /insert into public\.match_players/);
});
