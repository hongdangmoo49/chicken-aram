import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("limits match queries, paginates results, and indexes player history", async () => {
  const [siteData, home, schedule, results, migration] = await Promise.all([
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/schedule/page.tsx", root), "utf8"),
    readFile(new URL("app/results/page.tsx", root), "utf8"),
    readFile(new URL("supabase/migrations/202607230019_add_match_lookup_indexes.sql", root), "utf8"),
  ]);
  assert.match(siteData, /\.range\(options\.offset/);
  assert.match(siteData, /\.in\("match_id", matchIds\)/);
  assert.match(home, /getMatches\(\{ status: "completed", limit: 3 \}\)/);
  assert.match(schedule, /status: "scheduled", limit: 50/);
  assert.match(results, /pageSize = 10/);
  assert.match(results, /className="pagination"/);
  assert.match(migration, /match_players_player_id_idx/);
});
