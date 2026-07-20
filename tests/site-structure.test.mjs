import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the requested pages, Supabase auth, and a design contract", async () => {
  await Promise.all([
    access(new URL("app/tiers/page.tsx", root)),
    access(new URL("app/schedule/page.tsx", root)),
    access(new URL("app/results/page.tsx", root)),
    access(new URL("app/toast.tsx", root)),
    access(new URL("app/api/admin/role/route.ts", root)),
    access(new URL("app/api/schedule/[id]/route.ts", root)),
    access(new URL("app/admin/members/page.tsx", root)),
  ]);
  const [design, tiers, schedule, scheduleMutation, siteData, migration, login, profile, membersPage, ui, auth, roleRoute, roles, nicknameRoute, thumbnailRoute, authActions, toast, styles] = await Promise.all([
    readFile(new URL("DESIGN.md", root), "utf8"),
    readFile(new URL("app/tiers/page.tsx", root), "utf8"),
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
    readFile(new URL("app/api/schedule/[id]/route.ts", root), "utf8"),
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200002_remove_mock_data_and_auto_profiles.sql", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/profile/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/members/page.tsx", root), "utf8"),
    readFile(new URL("app/ui.tsx", root), "utf8"),
    readFile(new URL("app/auth.ts", root), "utf8"),
    readFile(new URL("app/api/admin/role/route.ts", root), "utf8"),
    readFile(new URL("app/roles.ts", root), "utf8"),
    readFile(new URL("app/api/profile/nickname/route.ts", root), "utf8"),
    readFile(new URL("app/api/profile/thumbnail/route.ts", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/toast.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(design, /Responsive Rules/);
  assert.match(tiers, /tier-player-card/);
  assert.match(tiers, /player\.wins.*승.*player\.losses.*패/);
  assert.match(tiers, /PlayerAvatar/);
  assert.match(schedule, /isAdmin\(user\.id\)/);
  assert.match(schedule, /scheduledAt\}\+09:00/);
  assert.match(scheduleMutation, /isAdmin\(user\.id\)/);
  assert.match(scheduleMutation, /action === "delete"/);
  assert.match(scheduleMutation, /scheduledAt\}\+09:00/);
  assert.match(siteData, /eq\("status", "scheduled"\)/);
  assert.match(migration, /delete from public\.matches/);
  assert.match(migration, /new\.raw_user_meta_data/);
  assert.match(login, /signUp/);
  assert.match(profile, /api\/profile\/nickname/);
  assert.doesNotMatch(profile, /api\/profile\/claim/);
  assert.doesNotMatch(profile, /멤버 권한 관리/);
  assert.match(membersPage, /멤버 권한 관리/);
  assert.match(membersPage, /role === "super_admin"/);
  assert.match(ui, /role !== "user"/);
  assert.match(ui, /\/admin\/members/);
  assert.match(ui, /PlayerAvatar player=/);
  assert.match(auth, /display_name,thumbnail_key/);
  assert.match(roleRoute, /isSuperAdmin/);
  assert.match(roleRoute, /\/admin\/members/);
  assert.match(roles, /super_admin/);
  assert.match(roles, /getRole\(userId\)\) !== "user"/);
  assert.match(nicknameRoute, /이미 사용 중인 닉네임/);
  assert.match(nicknameRoute, /redirectWithToast/);
  assert.match(thumbnailRoute, /redirectWithToast/);
  assert.match(authActions, /admin\.listUsers/);
  assert.match(authActions, /이미 사용 중인 닉네임/);
  assert.match(authActions, /로그인했습니다/);
  assert.doesNotMatch(authActions, /emailRedirectTo|인증 메일/);
  assert.match(toast, /role=\{type === "error" \? "alert" : "status"\}/);
  assert.match(styles, /signup-form:valid/);
  assert.match(styles, /toast-success/);
});
