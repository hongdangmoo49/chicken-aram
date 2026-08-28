"use client";

import { useEffect, useRef } from "react";

export function TelegramLoginButton({ state }: { state: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", "chicken_aram_bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-auth-url", `/api/profile/telegram-link?state=${encodeURIComponent(state)}`);
    const root = container.current;
    root?.replaceChildren(script);
    return () => { root?.replaceChildren(); };
  }, [state]);

  return <div className="telegram-widget" ref={container} />;
}
