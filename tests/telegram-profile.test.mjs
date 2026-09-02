import assert from "node:assert/strict";
import test from "node:test";
import { telegramPositionCode, telegramPositionFromCode } from "../lib/player-positions.ts";
import { formatTelegramProfile } from "../lib/telegram-profile.ts";

test("formats a private Telegram profile and stable position callbacks", () => {
  assert.equal(telegramPositionFromCode(telegramPositionCode("탱커")), "탱커");
  assert.equal(telegramPositionFromCode("x"), null);
  const text = formatTelegramProfile({
    nickname: "재미",
    tier: 2,
    points: 7,
    positions: ["탱커", "메이지"],
    telegramUsername: "zaemi",
    matchWins: 8,
    matchLosses: 6,
    roundWins: 31,
    roundLosses: 27,
  });
  assert.match(text, /이름: 재미/);
  assert.match(text, /1순위: 탱커/);
  assert.match(text, /2순위: 메이지/);
  assert.match(text, /경기: 8승 6패 · 승률 57%/);
  assert.match(text, /라운드: 31승 27패 · 승률 53%/);
  assert.match(text, /Telegram 연동: ✅ @zaemi/);
});

test("all-rounder disables the secondary profile position", () => {
  const text = formatTelegramProfile({ nickname: "N", tier: 5, points: 0, positions: ["올라운더"], telegramUsername: null, matchWins: 0, matchLosses: 0, roundWins: 0, roundLosses: 0 });
  assert.match(text, /1순위: 올라운더/);
  assert.match(text, /2순위: 선택 불가/);
});
