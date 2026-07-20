import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the requested pages, Supabase auth, and a design contract", async () => {
  await Promise.all([
    access(new URL("app/tiers/page.tsx", root)),
    access(new URL("app/schedule/page.tsx", root)),
    access(new URL("app/results/page.tsx", root)),
  ]);
  const [design, schedule, migration, login, profile, nicknameRoute, authActions, styles] = await Promise.all([
    readFile(new URL("DESIGN.md", root), "utf8"),
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200002_remove_mock_data_and_auto_profiles.sql", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/profile/page.tsx", root), "utf8"),
    readFile(new URL("app/api/profile/nickname/route.ts", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(design, /Responsive Rules/);
  assert.match(schedule, /isAdmin\(user\.id\)/);
  assert.match(migration, /delete from public\.matches/);
  assert.match(migration, /new\.raw_user_meta_data/);
  assert.match(login, /signUp/);
  assert.match(profile, /api\/profile\/nickname/);
  assert.doesNotMatch(profile, /api\/profile\/claim/);
  assert.match(nicknameRoute, /이미 사용 중인 닉네임/);
  assert.match(authActions, /admin\.listUsers/);
  assert.match(authActions, /이미 사용 중인 닉네임/);
  assert.doesNotMatch(authActions, /emailRedirectTo|인증 메일/);
  assert.match(styles, /signup-form:valid/);
});
