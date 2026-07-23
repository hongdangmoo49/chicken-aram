import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("verifies the session and loads the linked profile in one query", async () => {
  const auth = await readFile(new URL("app/auth.ts", root), "utf8");

  assert.match(auth, /supabase\.auth\.getClaims\(\)/);
  assert.match(auth, /\.select\("display_name,role,players\(thumbnail_path\)"\)/);
  assert.doesNotMatch(auth, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(auth, /\.from\("players"\)/);
});
