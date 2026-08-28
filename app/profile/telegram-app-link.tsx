"use client";

import { useState } from "react";

export function TelegramAppLink({ linked }: { linked: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function startLink() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/telegram-link", { method: "POST" });
      const result = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (response.ok && result?.url) return void window.location.assign(result.url);
      setMessage(result?.error ?? "Telegram 앱을 열지 못했습니다.");
    } catch {
      setMessage("Telegram 연동 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="telegram-link-actions"><button className="button primary" disabled={loading} onClick={startLink} type="button">{loading ? "연결 중..." : linked ? "Telegram 앱으로 다시 연동" : "Telegram 앱으로 연동"}</button>{linked && <form action="/api/profile/telegram-unlink" method="post"><button className="button ghost" type="submit">치증 계정 연동 해제</button></form>}{message && <p className="telegram-link-message" role="alert">{message}</p>}</div>;
}
