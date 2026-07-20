import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth";
import { signIn, signUp } from "../auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; returnTo?: string }>;
}) {
  if (await getCurrentUser()) redirect("/profile");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/"><span className="brand-mark">ㅊ</span><span>치킨 <em>증바람</em></span></Link>
      <section className="auth-card panel">
        <div className="auth-heading">
          <span className="eyebrow">CHICKEN ARAM ACCOUNT</span>
          <h1>내전 계정</h1>
          <p>로그인하면 본인의 선수 프로필과 썸네일을 직접 관리할 수 있습니다.</p>
        </div>
        {params.error && <p className="form-message error" role="alert">{params.error}</p>}
        {params.message && <p className="form-message success">{params.message}</p>}
        <div className="auth-grid">
          <form action={signIn} className="form-grid">
            <h2>로그인</h2>
            <input name="returnTo" type="hidden" value={params.returnTo ?? "/profile"} />
            <div className="field"><label htmlFor="login-email">이메일</label><input id="login-email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="login-password">비밀번호</label><input id="login-password" name="password" type="password" autoComplete="current-password" required /></div>
            <button className="button primary" type="submit">로그인</button>
          </form>
          <form action={signUp} className="form-grid signup-form">
            <h2>회원가입</h2>
            <div className="field"><label htmlFor="signup-name">표시 이름</label><input id="signup-name" name="displayName" autoComplete="nickname" required /></div>
            <div className="field"><label htmlFor="signup-email">이메일</label><input id="signup-email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="signup-password">비밀번호</label><input id="signup-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
            <button className="button signup-button" type="submit">새 계정 만들기</button>
          </form>
        </div>
      </section>
    </main>
  );
}
