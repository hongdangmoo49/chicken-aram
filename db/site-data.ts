import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { balanceTeams } from "./team-balance";

export type Player = {
  id: number;
  nickname: string;
  tier: number;
  wins: number;
  losses: number;
  thumbnailKey: string | null;
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
  createdBy: string | null;
};

export type PlayerProfile = Player;

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

export async function getPlayers(): Promise<Player[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id,nickname,tier,wins,losses,thumbnail_path");
  if (error) fail("선수 목록 조회 실패", error);

  return (data ?? [])
    .map((player) => ({
      id: Number(player.id),
      nickname: player.nickname,
      tier: player.tier,
      wins: player.wins,
      losses: player.losses,
      thumbnailKey: player.thumbnail_path,
    }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const aGames = a.wins + a.losses;
      const bGames = b.wins + b.losses;
      const aRate = aGames ? a.wins / aGames : 0;
      const bRate = bGames ? b.wins / bGames : 0;
      return bRate - aRate || b.wins - a.wins;
    });
}

export async function getMatches(): Promise<Match[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,scheduled_at,map,status,team_a,team_b,a_score,b_score,mvp,created_by")
    .order("scheduled_at", { ascending: false });
  if (error) fail("대전 목록 조회 실패", error);

  return (data ?? []).map((match) => ({
    id: Number(match.id),
    scheduledAt: match.scheduled_at,
    map: match.map,
    status: match.status,
    teamRed: match.team_a.join(", "),
    teamBlue: match.team_b.join(", "),
    redScore: match.a_score,
    blueScore: match.b_score,
    mvp: match.mvp,
    createdBy: match.created_by,
  }));
}

export async function createBalancedSchedule(input: {
  scheduledAt: string;
  map: string;
  playerIds: number[];
  separatedGroups: number[][];
  createdBy: string;
}) {
  const allPlayers = await getPlayers();
  const selected = input.playerIds
    .map((id) => allPlayers.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  const { teamA, teamB } = balanceTeams(selected, input.separatedGroups);
  const admin = createSupabaseAdminClient();

  const { data: match, error: matchError } = await admin
    .from("matches")
    .insert({
      scheduled_at: input.scheduledAt,
      map: input.map,
      status: "scheduled",
      team_a: teamA.map((player) => player.nickname),
      team_b: teamB.map((player) => player.nickname),
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (matchError || !match) fail("대전 일정 생성 실패", matchError);

  const groupByPlayer = new Map(
    input.separatedGroups.flatMap((group, index) =>
      group.map((id) => [id, index + 1] as const),
    ),
  );
  const rows = [
    ...teamA.map((player) => ({ player, team: "A" as const })),
    ...teamB.map((player) => ({ player, team: "B" as const })),
  ].map(({ player, team }) => ({
    match_id: match.id,
    player_id: player.id,
    team,
    separated_group: groupByPlayer.get(player.id) ?? null,
  }));
  const { error: playerError } = await admin.from("match_players").insert(rows);
  if (playerError) {
    await admin.from("matches").delete().eq("id", match.id);
    fail("대전 참가자 저장 실패", playerError);
  }
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
    .select("id,nickname,tier,wins,losses,thumbnail_path")
    .eq("id", profile.player_id)
    .single();
  if (playerError || !player) fail("선수 프로필 조회 실패", playerError);
  return {
    id: Number(player.id),
    nickname: player.nickname,
    tier: player.tier,
    wins: player.wins,
    losses: player.losses,
    thumbnailKey: player.thumbnail_path,
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
}

export async function setPlayerThumbnail(playerId: number, thumbnailKey: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("players")
    .update({ thumbnail_path: thumbnailKey })
    .eq("id", playerId);
  if (error) fail("선수 썸네일 저장 실패", error);
}
