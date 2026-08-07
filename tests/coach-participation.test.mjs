import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shows coaches but excludes them from match participant controls", async () => {
  const [picker, schedule, siteData, migration] = await Promise.all([
    readFile(new URL("app/schedule/participant-picker.tsx", root), "utf8"),
    readFile(new URL("app/schedule/page.tsx", root), "utf8"),
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202608070024_add_fifth_player_tier.sql", root), "utf8"),
  ]);
  assert.match(picker, /coach \? !checked : participantSelectionDisabled/);
  assert.match(picker, /코치 · 대전 참가 제외/);
  assert.match(schedule, /player\.tier !== coachTier \|\| player\.id === member\.playerId/);
  assert.match(siteData, /selected\.some\(\(player\) => player\.tier === coachTier\)/);
  assert.match(migration, /set tier = 6 where tier = 5/);
  assert.match(migration, /before insert or update of player_id/);
});
