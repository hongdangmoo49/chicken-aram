"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { roleLabels, type AppRole } from "../lib/app-roles";
import { signOut } from "./auth/actions";
import { PlayerAvatar } from "./player-ui";

type SessionUser = {
  displayName: string;
  thumbnailKey: string | null;
  role: AppRole;
};

const SessionContext = createContext<{ loading: boolean; user: SessionUser | null } | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ loading: boolean; user: SessionUser | null }>({ loading: true, user: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<SessionUser | null> : null)
      .then((user) => setSession({ loading: false, user }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSession({ loading: false, user: null });
      });
    return () => controller.abort();
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is missing.");
  return session;
}

export function AccountMenu() {
  const { loading, user } = useSession();
  if (loading) return <span aria-label="계정 확인 중" className="account-loading" />;
  if (!user) return <Link className="account-link" href="/login">로그인</Link>;

  return <>
    <div className="account-profile"><PlayerAvatar player={{ nickname: user.displayName, thumbnailKey: user.thumbnailKey }} /><div className="account-copy"><strong>{user.displayName}</strong><span>{roleLabels[user.role]}</span></div></div>
    {user.role !== "user" && <Link className="admin-access-link" href="/admin/members">멤버 관리</Link>}
    <form action={signOut}><button className="account-link" type="submit">로그아웃</button></form>
  </>;
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  return user && user.role !== "user" ? children : null;
}

export function AdminGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { loading, user } = useSession();
  if (loading) return <div className="permission-note"><strong>권한 확인 중</strong>관리자 기능을 준비하고 있습니다.</div>;
  return user && user.role !== "user" ? children : fallback;
}
