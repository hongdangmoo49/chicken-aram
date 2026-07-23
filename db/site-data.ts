import { revalidateTag, unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabasePublicClient } from "../lib/supabase/public";
import { normalizePlayerPositions, type PlayerPosition } from "../lib/player-positions";
import type { PlayerTierChange } from "../lib/player-tiers";
import type { MatchResultInput, MatchWinner } from "../lib/match-results";
import { calculateRoundRecord } from "../lib/player-records";
import { balanceTeams } from "./team-balance";

export type Player = {
  id: number;
  nickname: string;
  tier: number;
  wins: number;
  losses: number;
  thumbnailKey: string | null;
  positions: PlayerPosition[];
  tierOrder: number | null;
};

export type Match = {
  id: number;
  scheduledAt: string;
  map: string;
  status: "scheduled" | "completed";
  teamRed: string;
  teamBlue: string;
  redScore: number | null;
  blueScore: number | null;
  mvp: string | null;
  mvpPlayerId: number | null;
  winner: MatchWinner | null;
  createdBy: string | null;
};

export type MatchParticipant = {
  matchId: number;
  playerId: number;
  team: MatchWinner;
  separatedGroup: number | null;
};

export type PlayerProfile = Player & { roundWins: number; roundLosses: number };

const CACHE_SECONDS = 300;
const PLAYERS_CACHE_TAG = "players";
const MATCHES_CACHE_TAG = "matches";

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

function expirePublicCache(...tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}

async function loadPlayers(): Promise<Player[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("players")
    .select("id,nickname,tier,wins,losses,thumbnail_path,preferred_positions,tier_order");
  if (error) fail("선수 목록 조회 실패", error);

  return (data ?? [])
    .map((player) => ({
      id: Number(player.id),
      nickname: player.nickname,
      tier: player.tier,
      wins: player.wins,
      losses: player.losses,
      thumbnailKey: player.thumbnail_path,
      positions: normalizePlayerPositions(player.preferred_positions ?? []) ?? [],
      tierOrder: player.tier_order,
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tierOrder !== null || b.tierOrder !== null) return (a.tierOrder ?? Number.MAX_SAFE_INTEGER) - (b.tierOrder ?? Number.MAX_SAFE_INTEGER);
      const aGames = a.wins + a.losses;
      const bGames = b.wins + b.losses;
      const aRate = aGames ? a.wins / aGames : 0;
      const bRate = bGames ? b.wins / bGames : 0;
      return bRate - aRate || b.wins - a.wins;
    });
}

export const getPlayers = unstable_cache(loadPlayers, ["players"], { revalidate: CACHE_SECONDS, tags: [PLAYERS_CACHE_TAG] });

async function loadMatches(options: { status?: Match["status"]; limit?: number; offset?: number; ascending?: boolean } = {}): Promise<Match[]> {
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("matches")
    .select("id,scheduled_at,played_at,map,status,team_a,team_b,a_score,b_score,mvp,mvp_player_id,winner,created_by");
  if (options.status) query = query.eq("status", options.status);
  query = query.order(options.status === "completed" ? "played_at" : "scheduled_at", { ascending: options.ascending ?? false });
  if (options.limit) query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
  const { data, error } = await query;
  if (error) fail("대전 목록 조회 실패", error);

  return (data ?? []).map((match) => ({
    id: Number(match.id),
    scheduledAt: match.played_at ?? match.scheduled_at,
    map: match.map,
    status: match.status,
    teamRed: match.team_a.join(", "),
    teamBlue: match.team_b.join(", "),
    redScore: match.a_score,
    blueScore: match.b_score,
    mvp: match.mvp,
    mvpPlayerId: match.mvp_player_id === null ? null : Number(match.mvp_player_id),
    winner: match.winner as MatchWinner | null,
    createdBy: match.created_by,
  }));
}

const getCachedMatches = unstable_cache(loadMatches, ["matches"], { revalidate: CACHE_SECONDS, tags: [MATCHES_CACHE_TAG] });

export async function getMatches(options: { status?: Match["status"]; limit?: number; offset?: number; ascending?: boolean } = {}): Promise<Match[]> {
  return getCachedMatches(options);
}

async function loadMatchCounts() {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("get_match_counts").single();
  if (error || !data) fail("대전 수 조회 실패", error);
  const counts = data as { total: number | string; completed: number | string; scheduled: number | string };
  return { total: Number(counts.total), completed: Number(counts.completed), scheduled: Number(counts.scheduled) };
}

export const getMatchCounts = unstable_cache(loadMatchCounts, ["match-counts"], { revalidate: CACHE_SECONDS, tags: [MATCHES_CACHE_TAG] });

async function loadMatchParticipants(matchIds: number[]): Promise<MatchParticipant[]> {
  if (!matchIds.length) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.from("match_players").select("match_id,player_id,team,separated_group").in("match_id", matchIds);
  if (error) fail("대전 참가자 조회 실패", error);
  return (data ?? []).map((member) => ({ matchId: Number(member.match_id), playerId: Number(member.player_id), team: member.team as MatchWinner, separatedGroup: member.separated_group }));
}

const getCachedMatchParticipants = unstable_cache(loadMatchParticipants, ["match-participants"], { revalidate: CACHE_SECONDS, tags: [MATCHES_CACHE_TAG] });

export async function getMatchParticipants(matchIds: number[] = []): Promise<MatchParticipant[]> {
  return getCachedMatchParticipants([...matchIds].sort((a, b) => a - b));
}

export async function createBalancedSchedule(input: {
  scheduledAt: string;
  map: string;
  playerIds: number[];
  separatedGroups: number[][];
  createdBy: string;
}) {
  const allPlayers = await loadPlayers();
  const selected = input.playerIds
    .map((id) => allPlayers.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  const { teamA, teamB } = balanceTeams(selected, input.separatedGroups);
  const admin = createSupabaseAdminClient();

  const groupByPlayer = new Map(
    input.separatedGroups.flatMap((group, index) =>
      group.map((id) => [id, index + 1] as const),
    ),
  );
  const rows = [
    ...teamA.map((player) => ({ player, team: "A" as const })),
    ...teamB.map((player) => ({ player, team: "B" as const })),
  ].map(({ player, team }) => ({
    player_id: player.id,
    team,
    separated_group: groupByPlayer.get(player.id) ?? null,
  }));
  const { error } = await admin.rpc("create_balanced_schedule", {
    p_scheduled_at: input.scheduledAt,
    p_map: input.map,
    p_created_by: input.createdBy,
    p_assignments: rows.map((row) => ({ playerId: row.player_id, team: row.team, separatedGroup: row.separated_group })),
  });
  if (error) fail("대전 일정 생성 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function updateScheduledMatch(id: number, scheduledAt: string, map: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("matches")
    .update({ scheduled_at: scheduledAt, map })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error || !data) fail("예정 대전 수정 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function rebalanceScheduledMatch(input: { id: number; scheduledAt: string; map: string; playerIds: number[]; separatedGroups: number[][] }) {
  const allPlayers = await loadPlayers();
  const selected = input.playerIds.map((id) => allPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const admin = createSupabaseAdminClient();
  const { data: currentMembers, error: memberError } = await admin.from("match_players").select("player_id,team").eq("match_id", input.id);
  if (memberError) fail("기존 팀 조회 실패", memberError);
  const { teamA, teamB } = balanceTeams(selected, input.separatedGroups, (currentMembers ?? []).filter((member) => member.team === "A").map((member) => Number(member.player_id)));
  const groupByPlayer = new Map(input.separatedGroups.flatMap((group, index) => group.map((id) => [id, index + 1] as const)));
  const assignments = [...teamA.map((player) => ({ playerId: player.id, team: "A" as const })), ...teamB.map((player) => ({ playerId: player.id, team: "B" as const }))].map((assignment) => ({ ...assignment, separatedGroup: groupByPlayer.get(assignment.playerId) ?? null }));
  const { error } = await admin.rpc("rebalance_scheduled_match", { p_match_id: input.id, p_scheduled_at: input.scheduledAt, p_map: input.map, p_assignments: assignments });
  if (error) fail("팀 재편성 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function replaceScheduledMatchPlayers(input: { id: number; scheduledAt: string; map: string; teamAIds: number[]; teamBIds: number[] }) {
  const allPlayers = await loadPlayers();
  const selected = [...input.teamAIds, ...input.teamBIds].map((id) => allPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  if (selected.length !== 10) throw new Error("교체할 선수 정보를 확인해 주세요.");
  if (selected.some((player) => player.tier === 5)) throw new Error("코치는 대전 참가자로 선택할 수 없습니다.");
  const admin = createSupabaseAdminClient();
  const assignments = [...input.teamAIds.map((playerId) => ({ playerId, team: "A" as const })), ...input.teamBIds.map((playerId) => ({ playerId, team: "B" as const }))].map((assignment) => ({ ...assignment, separatedGroup: null }));
  const { error } = await admin.rpc("rebalance_scheduled_match", { p_match_id: input.id, p_scheduled_at: input.scheduledAt, p_map: input.map, p_assignments: assignments });
  if (error) fail("팀 선수 교체 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function deleteScheduledMatch(id: number) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("matches")
    .delete()
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error || !data) fail("예정 대전 삭제 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("player_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) fail("프로필 조회 실패", profileError);
  if (!profile?.player_id) return null;

  const { data: player, error: playerError } = await admin
    .from("players")
    .select("id,nickname,tier,wins,losses,thumbnail_path,preferred_positions,tier_order")
    .eq("id", profile.player_id)
    .single();
  if (playerError || !player) fail("선수 프로필 조회 실패", playerError);
  const { data: roundResults, error: roundError } = await admin
    .from("match_players")
    .select("team,matches!inner(a_score,b_score,status)")
    .eq("player_id", player.id)
    .eq("matches.status", "completed");
  if (roundError) fail("라운드 전적 조회 실패", roundError);
  const roundRecord = calculateRoundRecord((roundResults ?? []).map((result) => {
    const match = result.matches as unknown as { a_score: number; b_score: number };
    return { team: result.team as MatchWinner, aScore: Number(match.a_score), bScore: Number(match.b_score) };
  }));
  return {
    id: Number(player.id),
    nickname: player.nickname,
    tier: player.tier,
    wins: player.wins,
    losses: player.losses,
    thumbnailKey: player.thumbnail_path,
    positions: normalizePlayerPositions(player.preferred_positions ?? []) ?? [],
    tierOrder: player.tier_order,
    ...roundRecord,
  };
}

export async function setPlayerNickname(userId: string, nickname: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ display_name: nickname })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) fail("선수 닉네임 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG);
}

export async function setPlayerThumbnail(playerId: number, thumbnailKey: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("players")
    .update({ thumbnail_path: thumbnailKey })
    .eq("id", playerId);
  if (error) fail("선수 썸네일 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG);
}

export async function setPlayerPositions(playerId: number, positions: PlayerPosition[]) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("players")
    .update({ preferred_positions: positions })
    .eq("id", playerId);
  if (error) fail("선호 포지션 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG);
}

export async function setPlayerTiers(changes: PlayerTierChange[]) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("set_player_tiers", { changes });
  if (error) fail("선수 티어 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG);
}

export async function saveMatchResult(input: MatchResultInput & { matchId: number }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("save_match_result", {
    p_match_id: input.matchId,
    p_played_at: input.playedAt,
    p_a_score: input.aScore,
    p_b_score: input.bScore,
    p_winner: input.winner,
    p_mvp_player_id: input.mvpPlayerId,
  });
  if (error) fail("대전 결과 저장 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG, PLAYERS_CACHE_TAG);
}
