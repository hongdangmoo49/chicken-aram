import "server-only";
import { unlinkTelegramAccount } from "./telegram-recruitments";
import { setPlayerNickname, setPlayerPositions } from "./site-data";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { normalizePlayerPositions, type PlayerPosition } from "../lib/player-positions";
import { calculateRoundRecord } from "../lib/player-records";
import type { TelegramProfileView } from "../lib/telegram-profile";

type LinkedProfile = { profileId: string; playerId: number; telegramUsername: string | null };

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

async function getLinkedProfile(telegramUserId: number): Promise<LinkedProfile | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id,player_id,telegram_username")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) fail("Telegram 프로필 연동 조회 실패", error);
  if (!data?.player_id) return null;
  return { profileId: String(data.id), playerId: Number(data.player_id), telegramUsername: data.telegram_username as string | null };
}

export async function getTelegramProfile(telegramUserId: number): Promise<TelegramProfileView | null> {
  const linked = await getLinkedProfile(telegramUserId);
  if (!linked) return null;
  const admin = createSupabaseAdminClient();
  const [{ data: player, error: playerError }, { data: results, error: resultError }] = await Promise.all([
    admin.from("players").select("nickname,tier,wins,losses,rank_points,preferred_positions").eq("id", linked.playerId).maybeSingle(),
    admin.from("match_players").select("team,matches!inner(a_score,b_score,status)").eq("player_id", linked.playerId).eq("matches.status", "completed"),
  ]);
  if (playerError || resultError) fail("Telegram 프로필 조회 실패", playerError ?? resultError);
  if (!player) return null;
  const roundRecord = calculateRoundRecord((results ?? []).map((result) => {
    const match = result.matches as unknown as { a_score: number; b_score: number };
    return { team: result.team as "A" | "B", aScore: Number(match.a_score), bScore: Number(match.b_score) };
  }));
  return {
    nickname: String(player.nickname),
    tier: Number(player.tier),
    points: Number(player.rank_points),
    positions: normalizePlayerPositions(player.preferred_positions ?? []) ?? [],
    telegramUsername: linked.telegramUsername,
    matchWins: Number(player.wins),
    matchLosses: Number(player.losses),
    ...roundRecord,
  };
}

export async function updateTelegramNickname(telegramUserId: number, nickname: string) {
  const linked = await getLinkedProfile(telegramUserId);
  if (!linked) return "unlinked" as const;
  try {
    await setPlayerNickname(linked.profileId, nickname);
    return "saved" as const;
  } catch (error) {
    if (error instanceof Error && error.message.includes("players_nickname_lower_key")) return "duplicate" as const;
    throw error;
  }
}

export async function updateTelegramPositions(telegramUserId: number, positions: PlayerPosition[]) {
  const linked = await getLinkedProfile(telegramUserId);
  if (!linked) return false;
  await setPlayerPositions(linked.playerId, positions);
  return true;
}

export async function unlinkTelegramProfile(telegramUserId: number) {
  const linked = await getLinkedProfile(telegramUserId);
  if (!linked) return false;
  await unlinkTelegramAccount(linked.profileId);
  return true;
}
