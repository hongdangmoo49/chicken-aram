"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page">
      <span className="eyebrow">TEMPORARY ERROR</span>
      <h1>화면을 불러오지 못했습니다.</h1>
      <p>잠시 후 다시 시도해 주세요.{error.digest ? ` 오류 번호: ${error.digest}` : ""}</p>
      <div>
        <button className="button primary" onClick={reset} type="button">다시 시도</button>
        <Link className="button ghost" href="/">홈으로 이동</Link>
      </div>
    </main>
  );
}
