import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { redirectWithToast } from "../../../lib/toast-response";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectWithToast(request, "/profile", "success", "이메일 인증을 완료했습니다.");
  }
  return redirectWithToast(request, "/login", "error", "인증 링크가 만료되었거나 올바르지 않습니다.");
}
