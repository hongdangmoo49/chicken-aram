import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatRecruitment, formatRecruitmentList, parseTelegramCommand, parseTelegramLinkToken, parseVoteHour, recruitmentScheduledAt } from "../lib/telegram-commands.ts";

test("parses custom recruitment commands without native Telegram polls", () => {
  assert.deepEqual(parseTelegramCommand("/create@chijeung_bot"), { name: "create", argument: "" });
  assert.deepEqual(parseTelegramCommand("/vote 9"), { name: "vote", argument: "9" });
  assert.deepEqual(parseTelegramCommand("/cancle 9"), { name: "cancle", argument: "9" });
  assert.deepEqual(parseTelegramCommand("/list"), { name: "list", argument: "" });
  assert.deepEqual(parseTelegramCommand("/start"), { name: "start", argument: "" });
  assert.equal(parseTelegramCommand("참가"), null);
  assert.equal(parseVoteHour("9"), 9);
  assert.equal(parseVoteHour("0"), null);
  assert.equal(parseVoteHour("24"), 24);
  assert.equal(parseVoteHour("25"), null);
  const token = "A".repeat(32);
  assert.equal(parseTelegramLinkToken(`link_${token}`), token);
  assert.equal(parseTelegramLinkToken("link_short"), null);
  assert.equal(recruitmentScheduledAt("2026-08-29", 21), "2026-08-29T12:00:00.000Z");
  assert.equal(recruitmentScheduledAt("2026-08-29", 24), "2026-08-29T15:00:00.000Z");
});

test("lists participants for a created start time", () => {
  const text = formatRecruitment({ id: 7, scheduledDate: "2026-08-28", hour: 9, status: "open", targetCount: 10, matchId: null, votes: [
    { telegramUserId: 1, displayName: "재미", username: "zaemi" },
    { telegramUserId: 2, displayName: "부처", username: null },
  ] });
  assert.match(text, /2026-08-28 9시 치증 모집/);
  assert.match(text, /2\/10명[\s\S]*재미 \(@zaemi\)[\s\S]*부처/);
  assert.match(text, /\/cancle 9/);
});

test("lists today's recruitments including full games", () => {
  const recruitments = [
    { id: 7, scheduledDate: "2026-08-28", hour: 9, status: "open", targetCount: 10, matchId: null, votes: [] },
    { id: 8, scheduledDate: "2026-08-28", hour: 21, status: "full", targetCount: 10, matchId: null, votes: [] },
  ];
  assert.match(formatRecruitmentList(recruitments), /오늘 치증 모집 2개/);
});

test("secures and persists webhook updates", async () => {
  const [route, database, migration, linkMigration, scheduleMigration, profile, linkButton, linkRoute, unlinkRoute, setup] = await Promise.all([
    readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/telegram-recruitments.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608280027_add_telegram_recruitments.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608280028_link_telegram_accounts.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608290029_create_schedule_from_telegram.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/telegram-app-link.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/telegram-link/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/telegram-unlink/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/setup-telegram-bot.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(route, /x-telegram-bot-api-secret-token/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /isTelegramChatAdmin/);
  assert.match(route, /claimTelegramUpdate/);
  assert.match(route, /callback_query/);
  assert.match(route, /recruit:view:/);
  assert.match(route, /saveRecruitmentVoteById/);
  assert.match(route, /모집 완료/);
  assert.match(route, /consumeTelegramLink/);
  assert.match(route, /recruit:schedule:/);
  assert.match(route, /createScheduleFromRecruitment/);
  assert.match(route, /recruit:delete-confirm:/);
  assert.match(route, /removeRecruitment/);
  assert.match(database, /\.eq\("scheduled_date", scheduledDate\)/);
  assert.match(database, /update\(\{ status: "expired" \}\).*\.is\("match_id", null\)/);
  assert.match(database, /create_telegram_schedule/);
  assert.doesNotMatch(route, /sendPoll|poll_answer/);
  assert.match(migration, /telegram_recruitments_one_time_per_chat/);
  assert.match(migration, /scheduled_date date not null/);
  assert.match(migration, /hour smallint not null/);
  assert.match(migration, /primary key \(recruitment_id, telegram_user_id\)/);
  assert.match(migration, /revoke all .* from public, anon, authenticated/s);
  assert.match(linkMigration, /profiles_telegram_user_id_key/);
  assert.match(linkMigration, /telegram_link_tokens/);
  assert.match(linkMigration, /consume_telegram_link/);
  assert.match(linkMigration, /grant execute .* to service_role/);
  assert.match(scheduleMigration, /add column match_id bigint unique/);
  assert.match(scheduleMigration, /for update/);
  assert.match(scheduleMigration, /create_telegram_schedule/);
  assert.match(profile, /텔레그램 앱 간편 연동/);
  assert.match(linkButton, /Telegram 앱으로 연동/);
  assert.match(linkButton, /window\.location\.assign/);
  assert.match(linkButton, /telegram-unlink/);
  assert.match(linkRoute, /export async function POST/);
  assert.match(linkRoute, /https:\/\/t\.me\/chicken_aram_bot\?start=link_/);
  assert.match(linkRoute, /Response\.json/);
  assert.match(linkRoute, /createTelegramLink/);
  assert.match(linkRoute, /takeRateLimit/);
  assert.match(unlinkRoute, /unlinkTelegramAccount/);
  assert.match(setup, /allowed_updates: \["message", "callback_query"\]/);
});
