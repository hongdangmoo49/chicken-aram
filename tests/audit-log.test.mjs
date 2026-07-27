import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("admin mutations write actor-aware audit logs", async () => {
  const [migration, cleanupMigration, roles, tierRoute, resultRoute, auditPage] = await Promise.all([
    readFile(new URL("supabase/migrations/202607230021_admin_audit_logs.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607270022_drop_legacy_admin_rpcs.sql", root), "utf8"),
    readFile(new URL("app/roles.ts", root), "utf8"),
    readFile(new URL("app/api/admin/player-tier/route.ts", root), "utf8"),
    readFile(new URL("app/api/results/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/admin/audit/page.tsx", root), "utf8"),
  ]);

  assert.match(migration, /create table public\.audit_logs/);
  assert.match(migration, /insert into public\.audit_logs/g);
  assert.match(migration, /set_member_roles\(changes jsonb, p_actor_id uuid\)/);
  assert.match(migration, /set_player_tiers\(changes jsonb, p_actor_id uuid\)/);
  assert.match(migration, /p_actor_id uuid[\s\S]*matches\.result\.save/);
  assert.match(cleanupMigration, /drop function if exists public\.set_player_tiers\(jsonb\)/);
  assert.match(cleanupMigration, /drop function if exists public\.set_member_roles\(jsonb\)/);
  assert.match(cleanupMigration, /drop function if exists public\.save_match_result\(bigint, timestamptz, smallint, smallint, public\.match_team, bigint\)/);
  assert.match(roles, /p_actor_id: actorId/);
  assert.match(tierRoute, /setPlayerTiers\(changes, user\.id\)/);
  assert.match(resultRoute, /actorId: user\.id/);
  assert.match(auditPage, /requireCurrentUser\("\/admin\/audit"\)/);
  assert.match(auditPage, /변경 전후 값 보기/);
});
