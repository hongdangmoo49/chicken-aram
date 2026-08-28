import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramLoginPayload = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

function telegramStateSignature(profileId: string, timestamp: number, botToken: string) {
  return createHmac("sha256", botToken).update(`${profileId}:${timestamp}`).digest("base64url");
}

export function createTelegramLoginState(profileId: string, botToken: string, now = Math.floor(Date.now() / 1000)) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return `${now}.${telegramStateSignature(profileId, now, botToken)}`;
}

export function verifyTelegramLoginState(state: string, profileId: string, botToken: string, now = Math.floor(Date.now() / 1000)) {
  const [rawTimestamp, signature, ...rest] = state.split(".");
  const timestamp = Number(rawTimestamp);
  if (rest.length || !Number.isSafeInteger(timestamp) || timestamp < now - 600 || timestamp > now + 60 || !signature || !botToken) return false;
  const expected = Buffer.from(telegramStateSignature(profileId, timestamp, botToken));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyTelegramLogin(value: unknown, botToken: string, now = Math.floor(Date.now() / 1000)) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !botToken) return null;
  const input = value as Record<string, unknown>;
  const id = Number(input.id);
  const authDate = Number(input.auth_date);
  const hash = typeof input.hash === "string" && /^[0-9a-f]{64}$/i.test(input.hash) ? input.hash : null;
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(authDate) || authDate < now - 600 || authDate > now + 60 || !hash) return null;

  const fields = ["auth_date", "first_name", "id", "last_name", "photo_url", "username"];
  const dataCheckString = fields.flatMap((key) => typeof input[key] === "string" || typeof input[key] === "number" ? [`${key}=${input[key]}`] : []).join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { userId: id, username: typeof input.username === "string" && input.username ? input.username.slice(0, 32) : null };
}
