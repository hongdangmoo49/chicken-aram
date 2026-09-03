import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatRecruitment, formatRecruitmentList, formatTelegramMatchResult, parseTelegramCommand, parseTelegramLinkToken, parseTelegramResult, parseVoteHour, recruitmentScheduledAt, telegramWelcomeMessage } from "../lib/telegram-commands.ts";

test("parses custom recruitment commands without native Telegram polls", () => {
  assert.deepEqual(parseTelegramCommand("/create@chijeung_bot"), { name: "create", argument: "" });
  assert.deepEqual(parseTelegramCommand("/vote 9"), { name: "vote", argument: "9" });
  assert.deepEqual(parseTelegramCommand("/cancle 9"), { name: "cancle", argument: "9" });
  assert.deepEqual(parseTelegramCommand("/list"), { name: "list", argument: "" });
  assert.deepEqual(parseTelegramCommand("/result 21 3 1"), { name: "result", argument: "21 3 1" });
  assert.deepEqual(parseTelegramCommand("/profile"), { name: "profile", argument: "" });
  assert.deepEqual(parseTelegramCommand("/nickname 새 이름"), { name: "nickname", argument: "새 이름" });
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
  assert.deepEqual(parseTelegramResult("21 3 1"), { hour: 21, aScore: 3, bScore: 1, winner: "A" });
  assert.deepEqual(parseTelegramResult("9 1 2"), { hour: 9, aScore: 1, bScore: 2, winner: "B" });
  assert.equal(parseTelegramResult("21 2 2"), null);
});

test("welcomes new human group members with the game rules", () => {
  assert.match(telegramWelcomeMessage, /치킨증바람방에 오신 걸 환영합니다/);
  assert.match(telegramWelcomeMessage, /chicken-aram\.vercel\.app/);
  assert.match(telegramWelcomeMessage, /discord\.gg\/cjQ987bEh/);
  assert.match(telegramWelcomeMessage, /5판 3선승제\(BO5\)/);
  assert.match(telegramWelcomeMessage, /MVP 투표/);
  assert.ok(telegramWelcomeMessage.length <= 4096);
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

test("formats completed match results for the Telegram list detail", () => {
  assert.match(formatTelegramMatchResult({ aScore: 3, bScore: 1, winner: "A", teamA: ["A1", "A2"], teamB: ["B1", "B2"] }), /A팀 3 : 1 B팀[\s\S]*승리팀: A팀[\s\S]*A1 · A2[\s\S]*MVP 투표를 시작했습니다/);
  assert.match(formatRecruitment({ id: 9, scheduledDate: "2026-09-03", hour: 21, status: "expired", targetCount: 10, matchId: 12, matchStatus: "completed", votes: [] }), /🏁 경기 종료/);
});

test("secures and persists webhook updates", async () => {
  const [route, database, telegramProfile, profileFormatter, migration, linkMigration, scheduleMigration, hardeningMigration, profile, linkButton, linkRoute, unlinkRoute, setup, telegramApi, proxy] = await Promise.all([
    readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/telegram-recruitments.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/telegram-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/telegram-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608280027_add_telegram_recruitments.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608280028_link_telegram_accounts.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608290029_create_schedule_from_telegram.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202609020034_harden_telegram_recruitment.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/telegram-app-link.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/telegram-link/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/telegram-unlink/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/setup-telegram-bot.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/telegram-bot.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
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
  assert.match(route, /saveTelegramMatchResult/);
  assert.match(route, /command\.name === "result"/);
  assert.match(route, /getTelegramMvpState/);
  assert.match(route, /telegramMvpText/);
  assert.match(route, /경기 종료/);
  assert.match(route, /message\.chat\.type === "private"/);
  assert.match(route, /new_chat_members\?\.some\(\(member\) => !member\.is_bot\)/);
  assert.match(route, /command\.name === "profile"/);
  assert.match(route, /profile:position:p:/);
  assert.match(route, /profile:position:s:/);
  assert.match(route, /profile:unlink-confirm/);
  assert.match(telegramProfile, /calculateRoundRecord/);
  assert.match(telegramProfile, /setPlayerNickname/);
  assert.match(telegramProfile, /setPlayerPositions/);
  assert.match(profileFormatter, /승률.*%/s);
  assert.match(profileFormatter, /1순위/);
  assert.match(database, /\.eq\("scheduled_date", scheduledDate\)/);
  assert.match(database, /update\(\{ status: "expired" \}\).*\.is\("match_id", null\)/);
  assert.match(database, /create_telegram_schedule/);
  assert.match(database, /save_telegram_recruitment_vote/);
  assert.match(database, /claim_telegram_update/);
  assert.match(database, /matches\(status\)/);
  assert.match(hardeningMigration, /for update/);
  assert.match(hardeningMigration, /vote_count >= recruitment\.target_count/);
  assert.match(hardeningMigration, /processed_at < now\(\) - interval '7 days'/);
  assert.match(telegramApi, /AbortSignal\.timeout\(8_000\)/);
  assert.match(proxy, /api\/telegram\/webhook/);
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
  assert.match(setup, /command: "result"/);
  assert.match(setup, /command: "profile"/);
  assert.match(setup, /command: "nickname"/);
});
