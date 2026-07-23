import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps public pages cacheable and loads account controls separately", async () => {
  const [home, tiers, schedule, results, shell, sessionUi, sessionRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/tiers/page.tsx", root), "utf8"),
    readFile(new URL("app/schedule/page.tsx", root), "utf8"),
    readFile(new URL("app/results/page.tsx", root), "utf8"),
    readFile(new URL("app/ui.tsx", root), "utf8"),
    readFile(new URL("app/session-ui.tsx", root), "utf8"),
    readFile(new URL("app/api/session/route.ts", root), "utf8"),
  ]);

  for (const page of [home, tiers, schedule, results]) {
    assert.match(page, /export const revalidate = 300/);
    assert.doesNotMatch(page, /getCurrentUser|force-dynamic/);
  }
  assert.match(shell, /<AccountMenu \/>/);
  assert.doesNotMatch(shell, /getCurrentUser/);
  assert.match(sessionUi, /fetch\("\/api\/session"/);
  assert.match(sessionUi, /AdminOnly/);
  assert.match(sessionRoute, /private, no-store/);
});
