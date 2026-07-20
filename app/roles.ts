import { createSupabaseAdminClient } from "../lib/supabase/admin";

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`관리자 권한 조회 실패: ${error.message}`);
  return data?.role === "admin";
}
