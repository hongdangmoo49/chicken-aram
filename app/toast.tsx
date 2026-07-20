"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function Toast() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const message = searchParams.get("toast");
  const type = searchParams.get("toastType") === "error" ? "error" : "success";

  if (!message) return null;
  return <ToastMessage key={query} message={message} type={type} />;
}

function ToastMessage({ message, type }: { message: string; type: "success" | "error" }) {
  const router = useRouter();

  const dismiss = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("toastType");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [dismiss]);

  return (
    <div className={`toast toast-${type}`} role={type === "error" ? "alert" : "status"} aria-live="polite">
      <span className="toast-icon" aria-hidden="true">{type === "error" ? "!" : "✓"}</span>
      <span>{message}</span>
      <button type="button" onClick={dismiss} aria-label="알림 닫기">×</button>
    </div>
  );
}
