"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
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

  const { data: users, error: usersError } = await createSupabaseAdminClient()
    .auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) redirect(loginPath("error", "이메일 중복 확인에 실패했습니다. 잠시 후 다시 시도해 주세요."));
  if (users.users.some((user) => user.email?.toLowerCase() === email.toLowerCase())) {
    redirect(loginPath("error", "이미 가입된 이메일입니다. 로그인해 주세요."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) redirect(loginPath("error", "회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요."));
  redirect("/profile");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
