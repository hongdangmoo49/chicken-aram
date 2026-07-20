"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

function loginPath(kind: "error" | "message", value: string) {
  return `/login?${kind}=${encodeURIComponent(value)}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/profile");
  if (!email || !password) redirect(loginPath("error", "이메일과 비밀번호를 입력해 주세요."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(loginPath("error", "이메일 또는 비밀번호를 확인해 주세요."));
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/profile");
}

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!displayName || !email || password.length < 8) {
    redirect(loginPath("error", "이름, 이메일, 8자 이상의 비밀번호를 입력해 주세요."));
  }

  const requestHeaders = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) redirect(loginPath("error", "회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요."));
  if (data.session) redirect("/profile");
  redirect(loginPath("message", "인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요."));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
