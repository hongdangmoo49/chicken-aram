import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { verifyTelegramLogin } from "../lib/telegram-login.ts";

function signedPayload(token, now) {
  const payload = { auth_date: now, first_name: "재미", id: 123456789, username: "zaemi" };
  const check = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHash("sha256").update(token).digest();
  return { ...payload, hash: createHmac("sha256", secret).update(check).digest("hex") };
}

test("verifies fresh Telegram login signatures and rejects tampering", () => {
  const now = 1_788_000_000;
  const token = "123456:bot-secret";
  const payload = signedPayload(token, now);
  assert.deepEqual(verifyTelegramLogin(payload, token, now), { userId: 123456789, username: "zaemi" });
  assert.equal(verifyTelegramLogin({ ...payload, username: "attacker" }, token, now), null);
  assert.equal(verifyTelegramLogin(payload, token, now + 601), null);
});
