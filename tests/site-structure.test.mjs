import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the three requested pages and a design contract", async () => {
  await Promise.all([
    access(new URL("app/tiers/page.tsx", root)),
    access(new URL("app/schedule/page.tsx", root)),
    access(new URL("app/results/page.tsx", root)),
  ]);
  const [design, schedule] = await Promise.all([
    readFile(new URL("DESIGN.md", root), "utf8"),
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
  ]);
  assert.match(design, /Responsive Rules/);
  assert.match(schedule, /isAdmin\(user\.email\)/);
});
