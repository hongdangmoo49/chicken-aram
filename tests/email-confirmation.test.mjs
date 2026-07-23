import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("requires email ownership confirmation before first login", async () => {
  const [actions, callback, config] = await Promise.all([
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/auth/callback/route.ts", root), "utf8"),
    readFile(new URL("supabase/config.toml", root), "utf8"),
  ]);
  assert.match(actions, /emailRedirectTo/);
  assert.match(actions, /if \(data\.session\)/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(config, /enable_confirmations = true/);
});
