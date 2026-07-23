import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "./supabase/admin";

export async function clientAddress(request?: Request) {
  const requestHeaders = request?.headers ?? await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
}

export async function takeRateLimit(scope: string, subject: string, limit: number, windowSeconds: number) {
  const key = createHash("sha256").update(`${scope}:${subject}`).digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error);
    return false;
  }
  return data === true;
}
