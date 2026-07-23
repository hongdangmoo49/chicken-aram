import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shows a responsive and accessible route loading state", async () => {
  const [loading, styles] = await Promise.all([
    readFile(new URL("app/loading.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(styles, /@keyframes skeleton-shimmer/);
  assert.match(styles, /prefers-reduced-motion.*skeleton::after/s);
  assert.match(styles, /loading-grid \{ grid-template-columns: 1fr;/);
});
