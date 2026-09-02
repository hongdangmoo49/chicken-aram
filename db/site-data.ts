import { revalidateTag, unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabasePublicClient } from "../lib/supabase/public";
import { normalizePlayerPositions, type PlayerPosition } from "../lib/player-positions";
import { coachTier, type PlayerTierChange } from "../lib/player-tiers";
import type { MatchResultInput, MatchWinner } from "../lib/match-results";
import { currentMvpRound, topMvpCandidateIds } from "../lib/mvp-voting";
import { calculatePlayerComparison } from "../lib/player-comparison";
import { calculateRoundRecord } from "../lib/player-records";
import { balanceTeams, playerPower } from "./team-balance";

export type Player = {
  id: number;
  nickname: string;
  tier: number;
  wins: number;
  losses: number;
  points: number;
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
  mvpVotingStartedAt: string | null;
  winner: MatchWinner | null;
  createdBy: string | null;
};

export type MatchParticipant = {
  matchId: number;
  playerId: number;
  team: MatchWinner;
  separatedGroup: number | null;
  rankScore: number | null;
};

export type MvpAward = { matchId: number; team: MatchWinner; playerId: number; nickname: string; sourceRound: number };
export type MvpVotingContest = {
  matchId: number;
  playedAt: string;
  map: string;
  candidateTeam: MatchWinner;
  round: number;
  runoff: boolean;
  votesCast: number;
  selectedCandidateId: number | null;
  candidates: { id: number; nickname: string; thumbnailKey: string | null }[];
};

export type PlayerProfile = Player & { roundWins: number; roundLosses: number };
export type PlayerComparison = ReturnType<typeof calculatePlayerComparison> & { viewerPlayerId: number };

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
    .select("id,nickname,tier,wins,losses,rank_points,thumbnail_path,preferred_positions,tier_order")
    .eq("is_active", true);
  if (error) fail("선수 목록 조회 실패", error);

  return (data ?? [])
    .map((player) => ({
      id: Number(player.id),
      nickname: player.nickname,
      tier: player.tier,
      wins: player.wins,
      losses: player.losses,
      points: Number(player.rank_points),
      thumbnailKey: player.thumbnail_path,
      positions: normalizePlayerPositions(player.preferred_positions ?? []) ?? [],
      tierOrder: player.tier_order,
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.points !== b.points) return b.points - a.points;
      if (a.tierOrder !== null || b.tierOrder !== null) return (a.tierOrder ?? Number.MAX_SAFE_INTEGER) - (b.tierOrder ?? Number.MAX_SAFE_INTEGER);
      return b.wins - a.wins;
    });
}

export const getPlayers = unstable_cache(loadPlayers, ["players-position-priority-v5"], { revalidate: CACHE_SECONDS, tags: [PLAYERS_CACHE_TAG] });

async function loadMatches(options: { status?: Match["status"]; limit?: number; offset?: number; ascending?: boolean } = {}): Promise<Match[]> {
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("matches")
    .select("id,scheduled_at,played_at,map,status,team_a,team_b,a_score,b_score,mvp,mvp_player_id,mvp_voting_started_at,winner,created_by");
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
    mvpVotingStartedAt: match.mvp_voting_started_at,
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
  const { data, error } = await supabase.from("match_players").select("match_id,player_id,team,separated_group,players(tier,rank_points)").in("match_id", matchIds);
  if (error) fail("대전 참가자 조회 실패", error);
  return (data ?? []).map((member) => {
    const player = member.players as unknown as { tier: number; rank_points: number } | null;
    return { matchId: Number(member.match_id), playerId: Number(member.player_id), team: member.team as MatchWinner, separatedGroup: member.separated_group, rankScore: player ? playerPower({ tier: player.tier, points: Number(player.rank_points) }) : null };
  });
}

const getCachedMatchParticipants = unstable_cache(loadMatchParticipants, ["match-participants-rank-score-v4"], { revalidate: CACHE_SECONDS, tags: [MATCHES_CACHE_TAG] });

export async function getMatchParticipants(matchIds: number[] = []): Promise<MatchParticipant[]> {
  return getCachedMatchParticipants([...matchIds].sort((a, b) => a - b));
}

async function loadMvpAwards(matchIds: number[]): Promise<MvpAward[]> {
  if (!matchIds.length) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.from("match_mvp_awards").select("match_id,team,player_id,source_round,players(nickname)").in("match_id", matchIds);
  if (error) fail("MVP 수상자 조회 실패", error);
  return (data ?? []).map((award) => ({
    matchId: Number(award.match_id),
    team: award.team as MatchWinner,
    playerId: Number(award.player_id),
    nickname: (award.players as unknown as { nickname: string }).nickname,
    sourceRound: Number(award.source_round),
  }));
}

const getCachedMvpAwards = unstable_cache(loadMvpAwards, ["mvp-awards"], { revalidate: CACHE_SECONDS, tags: [MATCHES_CACHE_TAG] });

export async function getMvpAwards(matchIds: number[] = []) {
  return getCachedMvpAwards([...matchIds].sort((a, b) => a - b));
}

export async function getMvpVotingContests(userId: string): Promise<MvpVotingContest[]> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("player_id").eq("id", userId).maybeSingle();
  if (profileError) fail("MVP 투표 선수 조회 실패", profileError);
  if (!profile?.player_id) return [];
  const voterPlayerId = Number(profile.player_id);

  const { data: matches, error: matchError } = await admin
    .from("matches")
    .select("id,played_at,map")
    .eq("status", "completed")
    .not("mvp_voting_started_at", "is", null)
    .order("played_at", { ascending: false })
    .limit(50);
  if (matchError) fail("MVP 투표 경기 조회 실패", matchError);
  const matchIds = (matches ?? []).map((match) => Number(match.id));
  if (!matchIds.length) return [];

  const [memberResult, voteResult, awardResult] = await Promise.all([
    admin.from("match_players").select("match_id,player_id,team,players(id,nickname,thumbnail_path)").in("match_id", matchIds),
    admin.from("match_mvp_votes").select("match_id,candidate_team,round,voter_player_id,candidate_player_id").in("match_id", matchIds),
    admin.from("match_mvp_awards").select("match_id,team").in("match_id", matchIds),
  ]);
  if (memberResult.error) fail("MVP 후보 조회 실패", memberResult.error);
  if (voteResult.error) fail("MVP 투표 현황 조회 실패", voteResult.error);
  if (awardResult.error) fail("MVP 확정 현황 조회 실패", awardResult.error);

  const members = (memberResult.data ?? []).map((member) => {
    const player = member.players as unknown as { id: number; nickname: string; thumbnail_path: string | null };
    return { matchId: Number(member.match_id), playerId: Number(member.player_id), team: member.team as MatchWinner, nickname: player.nickname, thumbnailKey: player.thumbnail_path };
  });
  const votes = (voteResult.data ?? []).map((vote) => ({ matchId: Number(vote.match_id), candidateTeam: vote.candidate_team as MatchWinner, round: Number(vote.round), voterPlayerId: Number(vote.voter_player_id), candidatePlayerId: Number(vote.candidate_player_id) }));
  const awards = new Set((awardResult.data ?? []).map((award) => `${award.match_id}:${award.team}`));

  return (matches ?? []).flatMap((match) => {
    const matchId = Number(match.id);
    const voter = members.find((member) => member.matchId === matchId && member.playerId === voterPlayerId);
    if (!voter) return [];
    const candidateTeam: MatchWinner = voter.team === "A" ? "B" : "A";
    if (awards.has(`${matchId}:${candidateTeam}`)) return [];
    const contestVotes = votes.filter((vote) => vote.matchId === matchId && vote.candidateTeam === candidateTeam);
    const round = currentMvpRound(contestVotes);
    let candidates = members.filter((member) => member.matchId === matchId && member.team === candidateTeam);
    if (round > 1) {
      const previousVotes = contestVotes.filter((vote) => vote.round === round - 1);
      const finalistIds = topMvpCandidateIds(previousVotes);
      if (finalistIds.size < 2) return [];
      candidates = candidates.filter((candidate) => finalistIds.has(candidate.playerId));
    }
    const currentVotes = contestVotes.filter((vote) => vote.round === round);
    return [{
      matchId,
      playedAt: String(match.played_at),
      map: String(match.map),
      candidateTeam,
      round,
      runoff: round > 1,
      votesCast: currentVotes.length,
      selectedCandidateId: currentVotes.find((vote) => vote.voterPlayerId === voterPlayerId)?.candidatePlayerId ?? null,
      candidates: candidates.map((candidate) => ({ id: candidate.playerId, nickname: candidate.nickname, thumbnailKey: candidate.thumbnailKey })),
    }];
  });
}

export async function castMvpVote(input: { matchId: number; candidatePlayerId: number; actorId: string }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("cast_match_mvp_vote", { p_match_id: input.matchId, p_candidate_player_id: input.candidatePlayerId, p_actor_id: input.actorId });
  if (error) fail("MVP 투표 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG, MATCHES_CACHE_TAG);
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

export async function updateScheduledMatch(id: number, scheduledAt: string, map: string, actorId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("update_scheduled_match", { p_match_id: id, p_scheduled_at: scheduledAt, p_map: map, p_actor_id: actorId });
  if (error) fail("예정 대전 수정 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function rebalanceScheduledMatch(input: { id: number; scheduledAt: string; map: string; playerIds: number[]; separatedGroups: number[][]; actorId: string }) {
  const allPlayers = await loadPlayers();
  const selected = input.playerIds.map((id) => allPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const admin = createSupabaseAdminClient();
  const { data: currentMembers, error: memberError } = await admin.from("match_players").select("player_id,team").eq("match_id", input.id);
  if (memberError) fail("기존 팀 조회 실패", memberError);
  const { teamA, teamB } = balanceTeams(selected, input.separatedGroups, (currentMembers ?? []).filter((member) => member.team === "A").map((member) => Number(member.player_id)));
  const groupByPlayer = new Map(input.separatedGroups.flatMap((group, index) => group.map((id) => [id, index + 1] as const)));
  const assignments = [...teamA.map((player) => ({ playerId: player.id, team: "A" as const })), ...teamB.map((player) => ({ playerId: player.id, team: "B" as const }))].map((assignment) => ({ ...assignment, separatedGroup: groupByPlayer.get(assignment.playerId) ?? null }));
  const { error } = await admin.rpc("rebalance_scheduled_match", { p_match_id: input.id, p_scheduled_at: input.scheduledAt, p_map: input.map, p_assignments: assignments, p_actor_id: input.actorId });
  if (error) fail("팀 재편성 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function replaceScheduledMatchPlayers(input: { id: number; scheduledAt: string; map: string; teamAIds: number[]; teamBIds: number[]; actorId: string }) {
  const allPlayers = await loadPlayers();
  const selected = [...input.teamAIds, ...input.teamBIds].map((id) => allPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  if (selected.length !== 10) throw new Error("교체할 선수 정보를 확인해 주세요.");
  if (selected.some((player) => player.tier === coachTier)) throw new Error("코치는 대전 참가자로 선택할 수 없습니다.");
  const admin = createSupabaseAdminClient();
  const assignments = [...input.teamAIds.map((playerId) => ({ playerId, team: "A" as const })), ...input.teamBIds.map((playerId) => ({ playerId, team: "B" as const }))].map((assignment) => ({ ...assignment, separatedGroup: null }));
  const { error } = await admin.rpc("rebalance_scheduled_match", { p_match_id: input.id, p_scheduled_at: input.scheduledAt, p_map: input.map, p_assignments: assignments, p_actor_id: input.actorId });
  if (error) fail("팀 선수 교체 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG);
}

export async function deleteScheduledMatch(id: number, actorId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("delete_scheduled_match", { p_match_id: id, p_actor_id: actorId });
  if (error) fail("예정 대전 삭제 실패", error);
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
    .select("id,nickname,tier,wins,losses,rank_points,thumbnail_path,preferred_positions,tier_order")
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
    points: Number(player.rank_points),
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

export async function setPlayerTiers(changes: PlayerTierChange[], actorId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("set_player_tiers", { changes, p_actor_id: actorId });
  if (error) fail("선수 티어 저장 실패", error);
  expirePublicCache(PLAYERS_CACHE_TAG, MATCHES_CACHE_TAG);
}

export async function getPlayerComparison(userId: string, targetPlayerId: number): Promise<PlayerComparison | null> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("player_id").eq("id", userId).maybeSingle();
  if (profileError) fail("비교할 내 선수 조회 실패", profileError);
  if (!profile?.player_id) return null;
  const viewerPlayerId = Number(profile.player_id);
  if (viewerPlayerId === targetPlayerId) return { viewerPlayerId, sameTeam: { wins: 0, losses: 0 }, opponent: { wins: 0, losses: 0 } };

  const { data, error } = await admin
    .from("match_players")
    .select("match_id,player_id,team,matches!inner(status,winner)")
    .in("player_id", [viewerPlayerId, targetPlayerId])
    .eq("matches.status", "completed");
  if (error) fail("선수 상대 전적 조회 실패", error);
  const participations = (data ?? []).map((entry) => {
    const match = entry.matches as unknown as { winner: MatchWinner | null };
    return { matchId: Number(entry.match_id), playerId: Number(entry.player_id), team: entry.team as MatchWinner, winner: match.winner };
  });
  return { viewerPlayerId, ...calculatePlayerComparison(viewerPlayerId, targetPlayerId, participations) };
}

export async function saveMatchResult(input: MatchResultInput & { matchId: number; actorId: string }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("save_match_result", {
    p_match_id: input.matchId,
    p_played_at: input.playedAt,
    p_a_score: input.aScore,
    p_b_score: input.bScore,
    p_winner: input.winner,
    p_mvp_player_id: null,
    p_actor_id: input.actorId,
  });
  if (error) fail("대전 결과 저장 실패", error);
  expirePublicCache(MATCHES_CACHE_TAG, PLAYERS_CACHE_TAG);
}
