"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { clientAddress, takeRateLimit } from "../../lib/rate-limit";
import { siteUrl } from "../../lib/site-url";
import { withToast } from "../../lib/toast";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/profile");
  if (!email || !password) redirect(withToast("/login", "error", "이메일과 비밀번호를 입력해 주세요."));
  if (!(await takeRateLimit("sign-in", await clientAddress(), 10, 300))) {
    redirect(withToast("/login", "error", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(withToast("/login", "error", "이메일 또는 비밀번호를 확인해 주세요."));
  const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/profile";
  redirect(withToast(destination, "success", "로그인했습니다."));
}

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!displayName || displayName.length > 30 || !email || password.length < 8) {
    redirect(withToast("/login", "error", "1~30자 닉네임, 이메일, 8자 이상의 비밀번호를 입력해 주세요."));
  }
  if (!(await takeRateLimit("sign-up", await clientAddress(), 5, 3600))) {
    redirect(withToast("/login", "error", "회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."));
  }

  const admin = createSupabaseAdminClient();
  const [usersResult, profilesResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("display_name"),
  ]);
  const { data: users, error: usersError } = usersResult;
  if (usersError || profilesResult.error) redirect(withToast("/login", "error", "계정 중복 확인에 실패했습니다. 잠시 후 다시 시도해 주세요."));
  if (users.users.some((user) => user.email?.toLowerCase() === email.toLowerCase())) {
    redirect(withToast("/login", "error", "이미 가입된 이메일입니다. 로그인해 주세요."));
  }
  if ((profilesResult.data ?? []).some((profile) => profile.display_name?.trim().toLowerCase() === displayName.toLowerCase())) {
    redirect(withToast("/login", "error", "이미 사용 중인 닉네임입니다."));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) redirect(withToast("/login", "error", "회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요."));
  revalidateTag("players", { expire: 0 });
  if (data.session) {
    await supabase.auth.signOut();
    redirect(withToast("/login", "error", "이메일 인증 설정이 적용되지 않았습니다. 관리자에게 문의해 주세요."));
  }
  redirect(withToast("/login", "success", "인증 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요."));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  redirect(withToast("/", error ? "error" : "success", error ? "로그아웃하지 못했습니다." : "로그아웃했습니다."));
}
