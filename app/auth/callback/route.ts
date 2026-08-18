import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { redirectWithToast } from "../../../lib/toast-response";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const recovery = params.get("next") === "/reset-password";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectWithToast(request, recovery ? "/reset-password" : "/profile", "success", recovery ? "새 비밀번호를 입력해 주세요." : "이메일 인증을 완료했습니다.");
  }
  return redirectWithToast(request, "/login", "error", "인증 링크가 만료되었거나 올바르지 않습니다.");
}
