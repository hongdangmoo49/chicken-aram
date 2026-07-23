import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps database errors in server logs instead of user toasts", async () => {
  const routes = await Promise.all([
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
    readFile(new URL("app/api/schedule/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/results/[id]/route.ts", root), "utf8"),
  ]);
  for (const route of routes) {
    assert.match(route, /reportError/);
    assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
  }
});
