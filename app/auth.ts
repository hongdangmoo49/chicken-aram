import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import type { AppRole } from "./roles";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  thumbnailKey: string | null;
  role: AppRole;
};

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (error || !claims || !userId || !email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role,players(thumbnail_path)")
    .eq("id", userId)
    .maybeSingle();
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : {};
  const player = profile?.players as unknown as { thumbnail_path: string | null } | null;
  const displayName =
    profile?.display_name ??
    (typeof metadata.display_name === "string" ? metadata.display_name : null) ??
    (typeof metadata.full_name === "string" ? metadata.full_name : null) ??
    email.split("@")[0];

  const role = profile?.role === "admin" || profile?.role === "super_admin" ? profile.role : "user";
  return { id: userId, email, displayName, thumbnailKey: player?.thumbnail_path ?? null, role };
});

export async function requireCurrentUser(returnTo: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
