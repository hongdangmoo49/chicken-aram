import "server-only";
import { revalidateTag } from "next/cache";
import { buildTelegramMvpContests, type TelegramMvpContest, type TelegramMvpMember } from "../lib/mvp-voting";
import { siteUrl } from "../lib/site-url";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { editTelegramMessage, sendTelegramMessage, type TelegramInlineKeyboard } from "../lib/telegram-bot";

export type TelegramMvpState = {
  matchId: number;
  recruitmentId: number;
  chatId: number;
  messageId: number | null;
  playedAt: string;
  map: string;
  aScore: number;
  bScore: number;
  winner: "A" | "B";
  teamA: string[];
  teamB: string[];
  contests: TelegramMvpContest[];
};

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

export async function getTelegramMvpState(matchId: number): Promise<TelegramMvpState | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: recruitment, error: recruitmentError }, { data: match, error: matchError }] = await Promise.all([
    admin.from("telegram_recruitments").select("id,chat_id,mvp_message_id").eq("match_id", matchId).maybeSingle(),
    admin.from("matches").select("id,played_at,map,status,mvp_voting_started_at,a_score,b_score,winner,team_a,team_b").eq("id", matchId).maybeSingle(),
  ]);
  if (recruitmentError || matchError) fail("Telegram MVP 경기 조회 실패", recruitmentError ?? matchError);
  if (!recruitment || !match || match.status !== "completed" || !match.mvp_voting_started_at) return null;

  const [memberResult, voteResult, awardResult] = await Promise.all([
    admin.from("match_players").select("player_id,team,players(nickname)").eq("match_id", matchId),
    admin.from("match_mvp_votes").select("candidate_team,round,candidate_player_id").eq("match_id", matchId),
    admin.from("match_mvp_awards").select("team,player_id,players(nickname)").eq("match_id", matchId),
  ]);
  if (memberResult.error || voteResult.error || awardResult.error) fail("Telegram MVP 상태 조회 실패", memberResult.error ?? voteResult.error ?? awardResult.error);
  const members: TelegramMvpMember[] = (memberResult.data ?? []).map((member) => ({ playerId: Number(member.player_id), team: member.team as "A" | "B", nickname: (member.players as unknown as { nickname: string }).nickname }));
  const votes = (voteResult.data ?? []).map((vote) => ({ candidateTeam: vote.candidate_team as "A" | "B", round: Number(vote.round), candidatePlayerId: Number(vote.candidate_player_id) }));
  const awards = (awardResult.data ?? []).map((award) => ({ team: award.team as "A" | "B", playerId: Number(award.player_id), nickname: (award.players as unknown as { nickname: string }).nickname }));
  return { matchId, recruitmentId: Number(recruitment.id), chatId: Number(recruitment.chat_id), messageId: recruitment.mvp_message_id === null ? null : Number(recruitment.mvp_message_id), playedAt: String(match.played_at), map: String(match.map), aScore: Number(match.a_score), bScore: Number(match.b_score), winner: match.winner as "A" | "B", teamA: match.team_a as string[], teamB: match.team_b as string[], contests: buildTelegramMvpContests(members, votes, awards) };
}

export function telegramMvpText(state: TelegramMvpState) {
  const date = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(state.playedAt));
  return ["🏆 치증 MVP 투표", `${date} · ${state.map}`, "", ...state.contests.flatMap((contest) => contest.winner ? [`✅ ${contest.candidateTeam}팀 MVP: ${contest.winner.nickname} · RP +1`, ""] : [`${contest.candidateTeam}팀 MVP${contest.round > 1 ? ` · 재투표 ${contest.round}라운드` : ""} · ${contest.votesCast}/5명`, `${contest.candidateTeam === "A" ? "B" : "A"}팀 참가자가 투표해 주세요.`, ""]), "투표자는 공개되지 않으며 완료 전까지 선택을 변경할 수 있습니다."].join("\n");
}

export function telegramMvpKeyboard(state: TelegramMvpState): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  for (const contest of state.contests.filter((item) => !item.winner)) {
    for (let index = 0; index < contest.candidates.length; index += 2) rows.push(contest.candidates.slice(index, index + 2).map((candidate) => ({ text: `${contest.candidateTeam}팀 · ${candidate.nickname}`, callback_data: `mvp:${state.matchId}:${candidate.id}` })));
  }
  rows.push([{ text: "🌐 사이트에서 결과 확인", url: `${siteUrl}/results` }]);
  return { inline_keyboard: rows };
}

export async function syncTelegramMvpMessage(matchId: number) {
  const state = await getTelegramMvpState(matchId);
  if (!state) return false;
  const text = telegramMvpText(state);
  const keyboard = telegramMvpKeyboard(state);
  if (state.messageId) {
    try {
      await editTelegramMessage(state.chatId, state.messageId, text, keyboard);
      return true;
    } catch {
      // Message may have been manually removed; recreate it below.
    }
  }
  const message = await sendTelegramMessage(state.chatId, text, keyboard);
  if (!message) throw new Error("Telegram MVP message was not returned.");
  const { error } = await createSupabaseAdminClient().from("telegram_recruitments").update({ mvp_message_id: message.message_id }).eq("id", state.recruitmentId);
  if (error) fail("Telegram MVP 메시지 저장 실패", error);
  return true;
}

export async function castTelegramMvpVote(input: { matchId: number; candidatePlayerId: number; telegramUserId: number; chatId: number }) {
  const admin = createSupabaseAdminClient();
  const [{ data: profile, error: profileError }, { data: recruitment, error: recruitmentError }] = await Promise.all([
    admin.from("profiles").select("id").eq("telegram_user_id", input.telegramUserId).maybeSingle(),
    admin.from("telegram_recruitments").select("id").eq("match_id", input.matchId).eq("chat_id", input.chatId).maybeSingle(),
  ]);
  if (profileError || recruitmentError) fail("Telegram MVP 투표 계정 조회 실패", profileError ?? recruitmentError);
  if (!profile) return { status: "unlinked" as const };
  if (!recruitment) return { status: "rejected" as const };
  const { error } = await admin.rpc("cast_match_mvp_vote", { p_match_id: input.matchId, p_candidate_player_id: input.candidatePlayerId, p_actor_id: profile.id });
  if (error) {
    const expected = ["MVP voting is not open", "linked player is required", "voter must be a match participant", "candidate must be an opposing participant", "MVP voting is already finalized", "candidate is not in the runoff"];
    if (expected.some((message) => error.message.includes(message))) return { status: "rejected" as const };
    fail("Telegram MVP 투표 저장 실패", error);
  }
  revalidateTag("players", { expire: 0 });
  revalidateTag("matches", { expire: 0 });
  return { status: "saved" as const };
}

export async function saveTelegramMatchResult(input: { chatId: number; scheduledDate: string; hour: number; aScore: number; bScore: number; winner: "A" | "B"; telegramUserId: number }) {
  const admin = createSupabaseAdminClient();
  const [{ data: recruitment, error: recruitmentError }, { data: actor, error: actorError }] = await Promise.all([
    admin.from("telegram_recruitments").select("match_id").eq("chat_id", input.chatId).eq("scheduled_date", input.scheduledDate).eq("hour", input.hour).not("match_id", "is", null).maybeSingle(),
    admin.from("profiles").select("id,role").eq("telegram_user_id", input.telegramUserId).maybeSingle(),
  ]);
  if (recruitmentError || actorError) fail("Telegram 경기 결과 대상 조회 실패", recruitmentError ?? actorError);
  if (!recruitment?.match_id) return { status: "not_found" as const };
  if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) return { status: "not_authorized" as const };
  const matchId = Number(recruitment.match_id);
  const { data: match, error: matchError } = await admin.from("matches").select("status,team_a,team_b").eq("id", matchId).maybeSingle();
  if (matchError) fail("Telegram 경기 결과 상태 조회 실패", matchError);
  if (!match) return { status: "not_found" as const };
  if (match.status === "completed") return { status: "already_completed" as const, matchId };
  const { error } = await admin.rpc("save_match_result", { p_match_id: matchId, p_played_at: new Date().toISOString(), p_a_score: input.aScore, p_b_score: input.bScore, p_winner: input.winner, p_mvp_player_id: null, p_actor_id: actor.id });
  if (error) fail("Telegram 경기 결과 저장 실패", error);
  revalidateTag("players", { expire: 0 });
  revalidateTag("matches", { expire: 0 });
  return { status: "saved" as const, matchId, aScore: input.aScore, bScore: input.bScore, winner: input.winner, teamA: match.team_a as string[], teamB: match.team_b as string[] };
}
