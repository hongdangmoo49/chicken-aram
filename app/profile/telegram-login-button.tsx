"use client";

import { useEffect, useRef, useState } from "react";
import type { TelegramLoginPayload } from "../../lib/telegram-login";

declare global {
  interface Window { onTelegramAuth?: (user: TelegramLoginPayload) => void }
}

export function TelegramLoginButton() {
  const container = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.onTelegramAuth = async (payload) => {
      setMessage("연동 확인 중...");
      const response = await fetch("/api/profile/telegram-link", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (response.ok && result?.ok) return void window.location.assign("/profile?toast=%ED%85%94%EB%A0%88%EA%B7%B8%EB%9E%A8+%EA%B3%84%EC%A0%95%EC%9D%84+%EC%97%B0%EB%8F%99%ED%96%88%EC%8A%B5%EB%8B%88%EB%8B%A4.&toastType=success");
      setMessage(result?.error ?? "텔레그램 계정을 연동하지 못했습니다.");
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", "chicken_aram_bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    const root = container.current;
    root?.replaceChildren(script);
    return () => { delete window.onTelegramAuth; root?.replaceChildren(); };
  }, []);

  return <div className="telegram-widget"><div ref={container} />{message ? <p role="status">{message}</p> : null}</div>;
}
