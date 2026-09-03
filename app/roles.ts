import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { AppRole } from "../lib/app-roles";
import type { MemberRoleChange } from "../lib/member-roles";
import { currentMvpRound, missingMvpVoters } from "../lib/mvp-voting";
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

export type PendingMvpMatch = {
  id: number;
  playedAt: string;
  map: string;
  aScore: number;
  bScore: number;
  contests: {
    team: "A" | "B";
    round: number;
    votesCast: number;
    candidates: { id: number; nickname: string }[];
    votes: { voterId: number; voterNickname: string; candidatePlayerId: number; candidateNickname: string }[];
    missingVoters: { id: number; nickname: string }[];
  }[];
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

export async function getPendingMvpMatches(): Promise<PendingMvpMatch[]> {
  const admin = createSupabaseAdminClient();
  // ponytail: 개인 리그의 최근 완료 경기 50개만 확인. 누적 미완료가 50개를 넘으면 DB RPC로 필터링한다.
  const { data: matches, error: matchError } = await admin
    .from("matches")
    .select("id,played_at,map,a_score,b_score")
    .eq("status", "completed")
    .not("mvp_voting_started_at", "is", null)
    .order("played_at", { ascending: false })
    .limit(50);
  if (matchError) throw new Error(`미완료 MVP 경기 조회 실패: ${matchError.message}`);
  const matchIds = (matches ?? []).map((match) => Number(match.id));
  if (!matchIds.length) return [];

  const [memberResult, voteResult, awardResult] = await Promise.all([
    admin.from("match_players").select("match_id,player_id,team,players(nickname)").in("match_id", matchIds),
    admin.from("match_mvp_votes").select("match_id,candidate_team,round,voter_player_id,candidate_player_id").in("match_id", matchIds),
    admin.from("match_mvp_awards").select("match_id,team").in("match_id", matchIds),
  ]);
  const error = memberResult.error ?? voteResult.error ?? awardResult.error;
  if (error) throw new Error(`미완료 MVP 현황 조회 실패: ${error.message}`);

  const awards = new Set((awardResult.data ?? []).map((award) => `${award.match_id}:${award.team}`));
  return (matches ?? []).flatMap((match) => {
    const matchId = Number(match.id);
    const members = (memberResult.data ?? [])
      .filter((member) => Number(member.match_id) === matchId)
      .map((member) => ({ playerId: Number(member.player_id), team: member.team as "A" | "B", nickname: (member.players as unknown as { nickname: string }).nickname }));
    const nicknameByPlayerId = new Map(members.map((member) => [member.playerId, member.nickname]));
    const contests = (["A", "B"] as const).flatMap((team) => {
      if (awards.has(`${matchId}:${team}`)) return [];
      const votes = (voteResult.data ?? [])
        .filter((vote) => Number(vote.match_id) === matchId && vote.candidate_team === team)
        .map((vote) => ({ round: Number(vote.round), voterId: Number(vote.voter_player_id), candidatePlayerId: Number(vote.candidate_player_id) }));
      const round = currentMvpRound(votes);
      const candidates = members
        .filter((member) => member.team === team)
        .map(({ playerId: id, nickname }) => ({ id, nickname }))
        .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
      const currentVotes = votes.filter((vote) => vote.round === round);
      return [{
        team,
        round,
        votesCast: currentVotes.length,
        candidates,
        votes: currentVotes.map((vote) => ({
          voterId: vote.voterId,
          voterNickname: nicknameByPlayerId.get(vote.voterId) ?? `선수 #${vote.voterId}`,
          candidatePlayerId: vote.candidatePlayerId,
          candidateNickname: nicknameByPlayerId.get(vote.candidatePlayerId) ?? `선수 #${vote.candidatePlayerId}`,
        })).sort((a, b) => a.voterNickname.localeCompare(b.voterNickname, "ko")),
        missingVoters: missingMvpVoters(members, team, currentVotes.map((vote) => vote.voterId)),
      }];
    });
    return contests.length ? [{ id: matchId, playedAt: String(match.played_at), map: String(match.map), aScore: Number(match.a_score), bScore: Number(match.b_score), contests }] : [];
  });
}

export async function finalizeMatchMvp(input: { matchId: number; playerId: number; actorId: string }) {
  const { error } = await createSupabaseAdminClient().rpc("admin_finalize_match_mvp", {
    p_match_id: input.matchId,
    p_player_id: input.playerId,
    p_actor_id: input.actorId,
  });
  if (error) throw new Error(`MVP 수동 확정 실패: ${error.message}`);
  revalidateTag("players", { expire: 0 });
  revalidateTag("matches", { expire: 0 });
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
