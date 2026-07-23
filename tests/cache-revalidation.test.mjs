import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps public data warm and expires it after writes", async () => {
  const [siteData, authActions] = await Promise.all([
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
  ]);

  assert.match(siteData, /const CACHE_SECONDS = 300/);
  assert.match(siteData, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  assert.match(siteData, /expirePublicCache\(MATCHES_CACHE_TAG, PLAYERS_CACHE_TAG\)/);
  assert.match(authActions, /revalidateTag\("players", \{ expire: 0 \}\)/);
});
