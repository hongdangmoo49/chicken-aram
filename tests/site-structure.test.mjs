import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the requested pages, Supabase auth, and a design contract", async () => {
  await Promise.all([
    access(new URL("app/tiers/page.tsx", root)),
    access(new URL("app/tiers/tier-drag-board.tsx", root)),
    access(new URL("app/schedule/page.tsx", root)),
    access(new URL("app/results/page.tsx", root)),
    access(new URL("app/toast.tsx", root)),
    access(new URL("app/api/admin/role/route.ts", root)),
    access(new URL("app/api/admin/player-tier/route.ts", root)),
    access(new URL("app/api/profile/positions/route.ts", root)),
    access(new URL("app/api/schedule/[id]/route.ts", root)),
    access(new URL("app/admin/members/page.tsx", root)),
    access(new URL("app/admin/members/member-role-editor.tsx", root)),
  ]);
  const [design, tiers, tierDragBoard, schedule, scheduleMutation, siteData, migration, positionMigration, batchTierMigration, tierOrderMigration, batchRoleMigration, login, profile, membersPage, memberRoleEditor, ui, auth, roleRoute, tierRoute, roles, nicknameRoute, thumbnailRoute, positionRoute, authActions, toast, styles] = await Promise.all([
    readFile(new URL("DESIGN.md", root), "utf8"),
    readFile(new URL("app/tiers/page.tsx", root), "utf8"),
    readFile(new URL("app/tiers/tier-drag-board.tsx", root), "utf8"),
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
    readFile(new URL("app/api/schedule/[id]/route.ts", root), "utf8"),
    readFile(new URL("db/site-data.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200002_remove_mock_data_and_auto_profiles.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200006_add_player_positions.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200007_batch_player_tiers.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200008_add_tier_order.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607200009_batch_member_roles.sql", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("app/profile/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/members/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/members/member-role-editor.tsx", root), "utf8"),
    readFile(new URL("app/ui.tsx", root), "utf8"),
    readFile(new URL("app/auth.ts", root), "utf8"),
    readFile(new URL("app/api/admin/role/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/player-tier/route.ts", root), "utf8"),
    readFile(new URL("app/roles.ts", root), "utf8"),
    readFile(new URL("app/api/profile/nickname/route.ts", root), "utf8"),
    readFile(new URL("app/api/profile/thumbnail/route.ts", root), "utf8"),
    readFile(new URL("app/api/profile/positions/route.ts", root), "utf8"),
    readFile(new URL("app/auth/actions.ts", root), "utf8"),
    readFile(new URL("app/toast.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(design, /Responsive Rules/);
  assert.match(tiers, /TierDragBoard admin=\{admin\}/);
  assert.match(tierDragBoard, /tier-player-card/);
  assert.match(tierDragBoard, /player\.wins.*승.*player\.losses.*패/);
  assert.match(tierDragBoard, /PlayerAvatar/);
  assert.match(tierDragBoard, /draggable=\{admin\}/);
  assert.match(tierDragBoard, /handleDrop/);
  assert.match(tierDragBoard, /dropTarget/);
  assert.match(tierDragBoard, /변경사항 저장/);
  assert.match(tierDragBoard, /fetch\("\/api\/admin\/player-tier"/);
  assert.match(schedule, /isAdmin\(user\.id\)/);
  assert.match(schedule, /scheduledAt\}\+09:00/);
  assert.match(scheduleMutation, /isAdmin\(user\.id\)/);
  assert.match(scheduleMutation, /action === "delete"/);
  assert.match(scheduleMutation, /scheduledAt\}\+09:00/);
  assert.match(siteData, /eq\("status", "scheduled"\)/);
  assert.match(migration, /delete from public\.matches/);
  assert.match(migration, /new\.raw_user_meta_data/);
  assert.match(positionMigration, /cardinality\(preferred_positions\) <= 3/);
  assert.match(positionMigration, /올라운더/);
  assert.match(batchTierMigration, /set_player_tiers/);
  assert.match(batchTierMigration, /updated_count <> jsonb_array_length/);
  assert.match(tierOrderMigration, /add column tier_order/);
  assert.match(tierOrderMigration, /tier_order =/);
  assert.match(batchRoleMigration, /set_member_roles/);
  assert.match(batchRoleMigration, /profile\.role <> 'super_admin'/);
  assert.match(login, /signUp/);
  assert.match(profile, /api\/profile\/nickname/);
  assert.match(profile, /PositionPicker/);
  assert.match(profile, /tier-badge-\$\{profile\.tier\}/);
  assert.doesNotMatch(profile, /api\/profile\/claim/);
  assert.doesNotMatch(profile, /멤버 권한 관리/);
  assert.match(membersPage, /멤버 권한 관리/);
  assert.match(membersPage, /role === "super_admin"/);
  assert.match(memberRoleEditor, /변경사항 저장/);
  assert.match(memberRoleEditor, /fetch\("\/api\/admin\/role"/);
  assert.match(ui, /role !== "user"/);
  assert.match(ui, /\/admin\/members/);
  assert.match(ui, /PlayerAvatar player=/);
  assert.match(auth, /display_name,player_id/);
  assert.match(auth, /thumbnail_path/);
  assert.match(roleRoute, /isSuperAdmin/);
  assert.match(roleRoute, /normalizeMemberRoleChanges/);
  assert.match(roleRoute, /\/admin\/members/);
  assert.match(tierRoute, /isAdmin\(user\.id\)/);
  assert.match(tierRoute, /normalizeTierChanges/);
  assert.match(siteData, /setPlayerTiers/);
  assert.match(roles, /super_admin/);
  assert.match(roles, /getRole\(userId\)\) !== "user"/);
  assert.match(nicknameRoute, /이미 사용 중인 닉네임/);
  assert.match(nicknameRoute, /redirectWithToast/);
  assert.match(thumbnailRoute, /redirectWithToast/);
  assert.match(positionRoute, /normalizePlayerPositions/);
  assert.match(authActions, /admin\.listUsers/);
  assert.match(authActions, /이미 사용 중인 닉네임/);
  assert.match(authActions, /로그인했습니다/);
  assert.doesNotMatch(authActions, /emailRedirectTo|인증 메일/);
  assert.match(toast, /role=\{type === "error" \? "alert" : "status"\}/);
  assert.match(styles, /signup-form:valid/);
  assert.match(styles, /toast-success/);
  assert.match(styles, /tier-badge-1.*linear-gradient/);
  assert.match(styles, /tier-badge-4.*background: #20242b/);
});
