import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle();
  const displayName =
    profile?.display_name ??
    data.user.user_metadata?.display_name ??
    data.user.user_metadata?.full_name ??
    data.user.email.split("@")[0];

  return { id: data.user.id, email: data.user.email, displayName };
}

export async function requireCurrentUser(returnTo: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
