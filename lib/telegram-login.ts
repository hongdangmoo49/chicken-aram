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
