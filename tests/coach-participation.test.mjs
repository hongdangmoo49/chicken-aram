import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shows coaches but excludes them from match participant controls", async () => {
  const [picker, schedule, siteData] = await Promise.all([
    readFile(new URL("app/schedule/participant-picker.tsx", root), "utf8"),
    readFile(new URL("app/schedule/page.tsx", root), "utf8"),
    readFile(new URL("db/site-data.ts", root), "utf8"),
  ]);
  assert.match(picker, /coach \? !checked : participantSelectionDisabled/);
  assert.match(picker, /코치 · 대전 참가 제외/);
  assert.match(schedule, /player\.tier !== 5 \|\| player\.id === member\.playerId/);
  assert.match(siteData, /selected\.some\(\(player\) => player\.tier === 5\)/);
});
