import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps public data warm and expires it after writes", async () => {
  const [siteData, authActions, memberDeleteRoute, inactivePlayerMigration] = await Promise.all([
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/api/admin/member/[id]/route.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607270023_hide_deleted_account_players.sql", root), "utf8"),
  ]);

  assert.match(siteData, /const CACHE_SECONDS = 300/);
  assert.match(siteData, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  assert.match(siteData, /expirePublicCache\(MATCHES_CACHE_TAG, PLAYERS_CACHE_TAG\)/);
  assert.match(siteData, /\.eq\("is_active", true\)/);
  assert.match(authActions, /revalidateTag\("players", \{ expire: 0 \}\)/);
  assert.match(memberDeleteRoute, /update\(\{ is_active: false \}\)/);
  assert.match(memberDeleteRoute, /revalidateTag\("players", \{ expire: 0 \}\)/);
  assert.match(inactivePlayerMigration, /add column is_active boolean not null default true/);
  assert.match(inactivePlayerMigration, /members\.account\.delete/);
  assert.match(inactivePlayerMigration, /set is_active = true/);
});
