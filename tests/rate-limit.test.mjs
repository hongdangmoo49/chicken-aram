import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("rate limits authentication and every custom write endpoint", async () => {
  const files = [
    "app/auth/actions.ts",
    "app/api/profile/nickname/route.ts",
    "app/api/profile/positions/route.ts",
    "app/api/profile/thumbnail/route.ts",
    "app/api/admin/player-tier/route.ts",
    "app/api/admin/role/route.ts",
    "app/api/schedule/route.ts",
    "app/api/schedule/[id]/route.ts",
    "app/api/results/[id]/route.ts",
  ];
  for (const file of files) assert.match(await readFile(new URL(file, root), "utf8"), /takeRateLimit/);
  const migration = await readFile(new URL("supabase/migrations/202607230018_add_request_rate_limits.sql", root), "utf8");
  assert.match(migration, /on conflict \(key, window_started_at\)/);
  assert.match(migration, /grant execute .* to service_role/);
});
