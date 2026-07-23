import Link from "next/link";
import { redirect } from "next/navigation";
import { withToast } from "../../../lib/toast";
import { requireCurrentUser } from "../../auth";
import { getAuditLogs } from "../../roles";
import { PageShell } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "변경 기록" };

const actionLabels: Record<string, string> = {
  "players.rank.update": "선수 티어·순서 변경",
  "members.role.update": "멤버 권한 변경",
  "matches.result.save": "대전 결과 저장",
};

export default async function AuditPage() {
  const user = await requireCurrentUser("/admin/audit");
  if (user.role === "user") redirect(withToast("/profile", "error", "관리자 권한이 필요합니다."));
  const logs = await getAuditLogs();

  return <PageShell active="admin">
    <header className="page-intro">
      <div><span className="eyebrow">ADMIN AUDIT</span><h1>변경 기록</h1></div>
      <p>관리자가 변경한 티어·권한·대전 결과의 이전 값과 변경 값을 확인합니다.</p>
    </header>
    <nav className="admin-subnav"><Link className="button ghost" href="/admin/members">멤버 관리</Link></nav>
    <section className="audit-list">
      {logs.length ? logs.map((log) => <article className="audit-entry panel" key={log.id}>
        <header>
          <div><strong>{actionLabels[log.action] ?? log.action}</strong>{log.entityId && <span>#{log.entityId}</span>}</div>
          <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>
        </header>
        <p><strong>{log.actorName}</strong> 님이 변경했습니다.</p>
        <details>
          <summary>변경 전후 값 보기</summary>
          <pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre>
        </details>
      </article>) : <div className="empty panel">아직 기록된 관리자 변경이 없습니다.</div>}
    </section>
  </PageShell>;
}
