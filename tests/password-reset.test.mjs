import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("sends a recovery link and lets the authenticated user set a new password", async () => {
  const [actions, callback, login, resetPage] = await Promise.all([
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/auth/callback/route.ts", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/reset-password/page.tsx", root), "utf8"),
  ]);
  assert.match(login, /formAction=\{requestPasswordReset\}/);
  assert.match(actions, /resetPasswordForEmail/);
  assert.match(actions, /next=\/reset-password/);
  assert.match(actions, /takeRateLimit\("password-reset"/);
  assert.match(callback, /params\.get\("next"\) === "\/reset-password"/);
  assert.match(resetPage, /supabase\.auth\.getUser\(\)/);
  assert.match(resetPage, /minLength=\{8\}/);
  assert.match(actions, /updateUser\(\{ password \}\)/);
  assert.match(actions, /supabase\.auth\.signOut\(\)/);
});
