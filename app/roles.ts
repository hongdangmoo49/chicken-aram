import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { AppRole } from "../lib/app-roles";
import type { MemberRoleChange } from "../lib/member-roles";
import { calculateRoundRecord, formatRecentMatchRecord, type PlayerMatchResult, type PlayerRoundResult } from "../lib/player-records";

export type { AppRole } from "../lib/app-roles";

export type Member = {
  id: string;
  displayName: string;
  email: string | null;
  role: AppRole;
  telegram: { username: string | null } | null;
  record: {
    roundWins: number;
    roundLosses: number;
    matchWins: number;
    matchLosses: number;
    recentMatches: string;
  } | null;
};

export type AuditLog = {
  id: number;
  actorName: string;
  action: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export async function getMembers(includeEmails = false): Promise<Member[]> {
  const admin = createSupabaseAdminClient();
  // ponytail: 개인 리그의 라운드 참가 기록은 1,000건 미만. 넘으면 DB 집계 RPC로 바꾼다.
  const [{ data, error }, { data: roundResults, error: roundError }] = await Promise.all([
    admin.from("profiles").select("id,display_name,role,player_id,telegram_user_id,telegram_username,players(wins,losses)").order("created_at"),
    admin.from("match_players").select("player_id,team,matches!inner(a_score,b_score,status,winner,played_at)").eq("matches.status", "completed"),
  ]);
  if (error || roundError) throw new Error(`멤버 목록 조회 실패: ${error?.message ?? roundError?.message}`);

  const roundsByPlayerId = new Map<number, PlayerRoundResult[]>();
  const matchesByPlayerId = new Map<number, PlayerMatchResult[]>();
  for (const result of roundResults ?? []) {
    const match = result.matches as unknown as { a_score: number; b_score: number; winner: string | null; played_at: string | null };
    const playerId = Number(result.player_id);
    const team = result.team as PlayerRoundResult["team"];
    const rounds = roundsByPlayerId.get(playerId) ?? [];
    rounds.push({
      team,
      aScore: Number(match.a_score),
      bScore: Number(match.b_score),
    });
    roundsByPlayerId.set(playerId, rounds);
    if ((match.winner === "A" || match.winner === "B") && match.played_at) {
      const matches = matchesByPlayerId.get(playerId) ?? [];
      matches.push({ team, winner: match.winner, playedAt: match.played_at });
      matchesByPlayerId.set(playerId, matches);
    }
  }

  const emailById = new Map<string, string>();
  if (includeEmails) {
    // ponytail: 개인용 사이트의 1,000명 상한. 규모가 커지면 auth users 페이지네이션을 추가한다.
    const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) throw new Error(`멤버 이메일 조회 실패: ${authError.message}`);
    for (const user of authUsers.users) {
      if (user.email) emailById.set(user.id, user.email);
    }
  }

  return (data ?? []).map((member) => {
    const player = member.players as unknown as { wins: number; losses: number } | null;
    const playerId = member.player_id === null ? null : Number(member.player_id);
    return {
      id: member.id,
      displayName: member.display_name || "이름 없음",
      email: emailById.get(member.id) ?? null,
      role: member.role as AppRole,
      telegram: member.telegram_user_id ? { username: member.telegram_username as string | null } : null,
      record: player && playerId !== null ? {
        ...calculateRoundRecord(roundsByPlayerId.get(playerId) ?? []),
        matchWins: Number(player.wins),
        matchLosses: Number(player.losses),
        recentMatches: formatRecentMatchRecord(matchesByPlayerId.get(playerId) ?? []),
      } : null,
    };
  });
}

export async function setMemberRoles(changes: MemberRoleChange[], actorId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("set_member_roles", { changes, p_actor_id: actorId });
  if (error) throw new Error(`멤버 권한 변경 실패: ${error.message}`);
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("id,actor_name,action,entity_id,before_data,after_data,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`변경 기록 조회 실패: ${error.message}`);
  return (data ?? []).map((log) => ({
    id: Number(log.id),
    actorName: log.actor_name,
    action: log.action,
    entityId: log.entity_id,
    before: log.before_data,
    after: log.after_data,
    createdAt: log.created_at,
  }));
}
