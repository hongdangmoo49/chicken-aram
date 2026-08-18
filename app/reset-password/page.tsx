import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { updatePassword } from "../auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "비밀번호 재설정" };

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <main className="auth-page">
    <Link className="brand auth-brand" href="/"><span className="brand-mark">ㅊ</span><span>치킨 <em>증바람</em></span></Link>
    <section className="auth-card panel">
      <div className="auth-heading"><span className="eyebrow">PASSWORD RECOVERY</span><h1>새 비밀번호 설정</h1><p>8자 이상의 새 비밀번호를 입력해 주세요.</p></div>
      <form action={updatePassword} className="form-grid reset-password-form">
        <div className="field"><label htmlFor="new-password">새 비밀번호</label><input autoComplete="new-password" id="new-password" minLength={8} name="password" required type="password" /></div>
        <div className="field"><label htmlFor="confirm-password">새 비밀번호 확인</label><input autoComplete="new-password" id="confirm-password" minLength={8} name="confirmation" required type="password" /></div>
        <button className="button primary" type="submit">비밀번호 변경</button>
      </form>
    </section>
  </main>;
}
