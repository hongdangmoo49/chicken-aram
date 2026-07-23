import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && publishableKey && serviceRoleKey);

const client = (key) => createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

test("remote Supabase auth, RLS, triggers, and write RPCs", { skip: configured ? false : "Supabase smoke credentials are not configured" }, async () => {
  const admin = client(serviceRoleKey);
  const anonymous = client(publishableKey);

  const { data: samplePlayer, error: sampleError } = await admin.from("players").select("id,wins").limit(1).single();
  assert.ifError(sampleError);
  await anonymous.from("players").update({ wins: samplePlayer.wins + 100 }).eq("id", samplePlayer.id);
  const { data: unchangedPlayer, error: unchangedError } = await admin.from("players").select("wins").eq("id", samplePlayer.id).single();
  assert.ifError(unchangedError);
  assert.equal(unchangedPlayer.wins, samplePlayer.wins);

  const rateKey = createHash("sha256").update(`smoke:${randomUUID()}`).digest("hex");
  try {
    const first = await admin.rpc("consume_rate_limit", { p_key: rateKey, p_limit: 1, p_window_seconds: 60 });
    const second = await admin.rpc("consume_rate_limit", { p_key: rateKey, p_limit: 1, p_window_seconds: 60 });
    assert.ifError(first.error);
    assert.ifError(second.error);
    assert.equal(first.data, true);
    assert.equal(second.data, false);
  } finally {
    await admin.from("request_rate_limits").delete().eq("key", rateKey);
  }

  const invalidSchedule = await admin.rpc("create_balanced_schedule", {
    p_scheduled_at: new Date().toISOString(),
    p_map: "증강 칼바람 협곡",
    p_created_by: null,
    p_assignments: [],
  });
  assert.match(invalidSchedule.error?.message ?? "", /invalid schedule input/);

  const suffix = randomUUID().slice(0, 8);
  const email = `smoke-${suffix}@example.com`;
  const nickname = `smoke-${suffix}`;
  const password = `Smoke!9-${randomUUID()}`;
  let userId;
  let playerId;
  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { display_name: nickname },
    });
    assert.ifError(created.error);
    userId = created.data.user.id;
    assert.equal(Boolean(created.data.user.email_confirmed_at), false);

    const profile = await admin.from("profiles").select("display_name,player_id").eq("id", userId).single();
    assert.ifError(profile.error);
    assert.equal(profile.data.display_name, nickname);
    playerId = profile.data.player_id;

    const player = await admin.from("players").select("nickname").eq("id", playerId).single();
    assert.ifError(player.error);
    assert.equal(player.data.nickname, nickname);

    const signIn = await anonymous.auth.signInWithPassword({ email, password });
    assert.ok(signIn.error);
    assert.equal(signIn.data.session, null);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (playerId) await admin.from("players").delete().eq("id", playerId);
  }
});
