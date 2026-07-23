import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

export function createSupabasePublicClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
