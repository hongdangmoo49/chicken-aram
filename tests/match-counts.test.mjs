import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("loads all match counts with one database call", async () => {
  const [siteData, migration] = await Promise.all([
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607230020_get_match_counts.sql", root), "utf8"),
  ]);

  assert.match(siteData, /rpc\("get_match_counts"\)\.single\(\)/);
  assert.doesNotMatch(siteData, /Promise\.all\(\[count\(\), count\("completed"\), count\("scheduled"\)\]\)/);
  assert.match(migration, /count\(\*\) filter \(where status = 'completed'\)/);
  assert.match(migration, /grant execute .* to anon, authenticated, service_role/);
});
