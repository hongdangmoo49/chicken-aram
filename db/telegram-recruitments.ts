import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { recruitmentScheduledAt, type RecruitmentView, type RecruitmentVoteView } from "../lib/telegram-commands";
import { normalizePlayerPositions } from "../lib/player-positions";
import { prepareTelegramTeams, type LinkedTelegramPlayer } from "./team-balance";

type RecruitmentRow = {
  id: number | string;
  chat_id: number | string;
  message_id: number | string | null;
  match_id: number | string | null;
  scheduled_date: string;
  hour: number;
  target_count: number;
  status: "open" | "full" | "expired" | "failed";
  matches?: { status: "scheduled" | "completed" } | null;
};
type RecruitmentVoteRow = { telegram_user_id: number | string; display_name: string; username: string | null; created_at: string };

const recruitmentFields = "id,chat_id,message_id,match_id,scheduled_date,hour,target_count,status";

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

function telegramTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getTelegramConnection(profileId: string) {
  const { data, error } = await createSupabaseAdminClient().from("profiles").select("telegram_user_id,telegram_username").eq("id", profileId).maybeSingle();
  if (error) fail("Telegram 계정 연동 조회 실패", error);
  return data?.telegram_user_id ? { userId: Number(data.telegram_user_id), username: data.telegram_username as string | null } : null;
}

export async function unlinkTelegramAccount(profileId: string) {
  const admin = createSupabaseAdminClient();
  const [{ error: profileError }, { error: tokenError }] = await Promise.all([
    admin.from("profiles").update({ telegram_user_id: null, telegram_username: null }).eq("id", profileId),
    admin.from("telegram_link_tokens").delete().eq("profile_id", profileId),
  ]);
  if (profileError || tokenError) fail("Telegram 계정 연동 해제 실패", profileError ?? tokenError);
}

export async function createTelegramLink(profileId: string) {
  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const { error } = await createSupabaseAdminClient().from("telegram_link_tokens").upsert({ token_hash: telegramTokenHash(token), profile_id: profileId, expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(), created_at: now.toISOString() }, { onConflict: "profile_id" });
  if (error) fail("Telegram 계정 연동 링크 생성 실패", error);
  return token;
}

export async function consumeTelegramLink(token: string, telegramUserId: number, telegramUsername: string | null) {
  const { data, error } = await createSupabaseAdminClient().rpc("consume_telegram_link", { p_token_hash: telegramTokenHash(token), p_telegram_user_id: telegramUserId, p_telegram_username: telegramUsername ?? "" });
  if (error) fail("Telegram 계정 연동 실패", error);
  return data as { status: "ok" | "invalid" | "already_linked"; displayName?: string };
}

export async function claimTelegramUpdate(updateId: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("claim_telegram_update", { p_update_id: updateId });
  if (error) fail("Telegram update 저장 실패", error);
  return data === true;
}

export async function releaseTelegramUpdate(updateId: number) {
  const { error } = await createSupabaseAdminClient().from("telegram_updates").delete().eq("update_id", updateId);
  if (error) fail("Telegram update 재시도 준비 실패", error);
}

async function expireRecruitments(chatId: number) {
  const { error } = await createSupabaseAdminClient().from("telegram_recruitments").update({ status: "expired" }).eq("chat_id", chatId).in("status", ["open", "full"]).lte("expires_at", new Date().toISOString());
  if (error) fail("Telegram 모집 만료 실패", error);
}

async function recruitmentAt(chatId: number, scheduledDate: string, hour: number): Promise<RecruitmentRow | null> {
  await expireRecruitments(chatId);
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").select(recruitmentFields).eq("chat_id", chatId).eq("scheduled_date", scheduledDate).eq("hour", hour).in("status", ["open", "full"]).maybeSingle();
  if (error) fail("Telegram 모집 조회 실패", error);
  return data as RecruitmentRow | null;
}

export async function getRecruitmentById(chatId: number, scheduledDate: string, recruitmentId: number) {
  await expireRecruitments(chatId);
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").select(`${recruitmentFields},matches(status)`).eq("id", recruitmentId).eq("chat_id", chatId).eq("scheduled_date", scheduledDate).maybeSingle();
  if (error) fail("Telegram 모집 상세 조회 실패", error);
  const row = data as RecruitmentRow | null;
  return row && ((row.status === "open" || row.status === "full") || row.match_id !== null) ? { row, view: await recruitmentView(row) } : null;
}

export async function createRecruitment(chatId: number, createdBy: number, scheduledDate: string, hour: number) {
  const existing = await recruitmentAt(chatId, scheduledDate, hour);
  if (existing) return { recruitment: existing, created: false };
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").insert({ chat_id: chatId, created_by: createdBy, scheduled_date: scheduledDate, hour }).select(recruitmentFields).single();
  if (error || !data) fail("Telegram 모집 생성 실패", error);
  return { recruitment: data as RecruitmentRow, created: true };
}

export async function setRecruitmentMessage(recruitmentId: number, messageId: number) {
  const { error } = await createSupabaseAdminClient().from("telegram_recruitments").update({ message_id: messageId }).eq("id", recruitmentId);
  if (error) fail("Telegram 모집 메시지 저장 실패", error);
}

export async function failRecruitment(recruitmentId: number) {
  const { error } = await createSupabaseAdminClient().from("telegram_recruitments").update({ status: "failed" }).eq("id", recruitmentId);
  if (error) fail("Telegram 모집 실패 처리 오류", error);
}

async function recruitmentView(row: RecruitmentRow): Promise<RecruitmentView> {
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitment_votes").select("telegram_user_id,display_name,username,created_at").eq("recruitment_id", row.id).order("created_at");
  if (error) fail("Telegram 참여자 조회 실패", error);
  return recruitmentViewFromRows(row, data ?? []);
}

function recruitmentViewFromRows(row: RecruitmentRow, votes: RecruitmentVoteRow[]): RecruitmentView {
  return { id: Number(row.id), scheduledDate: row.scheduled_date, hour: Number(row.hour), status: row.status, targetCount: Number(row.target_count), matchId: row.match_id === null ? null : Number(row.match_id), matchStatus: row.matches?.status ?? null, votes: [...votes].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((vote) => ({ telegramUserId: Number(vote.telegram_user_id), displayName: vote.display_name, username: vote.username })) as RecruitmentVoteView[] };
}

export async function listRecruitments(chatId: number, scheduledDate: string) {
  await expireRecruitments(chatId);
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").select(`${recruitmentFields},matches(status),telegram_recruitment_votes(telegram_user_id,display_name,username,created_at)`).eq("chat_id", chatId).eq("scheduled_date", scheduledDate).order("hour");
  if (error) fail("Telegram 모집 목록 조회 실패", error);
  return (data ?? []).filter((item) => item.status === "open" || item.status === "full" || item.match_id !== null).map((item) => {
    const row = item as unknown as RecruitmentRow & { telegram_recruitment_votes: RecruitmentVoteRow[] };
    return { row, view: recruitmentViewFromRows(row, row.telegram_recruitment_votes) };
  });
}

export async function removeRecruitment(chatId: number, scheduledDate: string, recruitmentId: number) {
  await expireRecruitments(chatId);
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").update({ status: "expired" }).eq("id", recruitmentId).eq("chat_id", chatId).eq("scheduled_date", scheduledDate).is("match_id", null).in("status", ["open", "full"]).select(recruitmentFields).maybeSingle();
  if (error) fail("Telegram 모집 삭제 실패", error);
  return data as RecruitmentRow | null;
}

export async function createScheduleFromRecruitment(input: { chatId: number; scheduledDate: string; recruitmentId: number; actorTelegramUserId: number }) {
  const recruitment = await getRecruitmentById(input.chatId, input.scheduledDate, input.recruitmentId);
  if (!recruitment) return { status: "not_found" as const };
  if (recruitment.view.status !== "full" || recruitment.view.votes.length !== recruitment.view.targetCount) return { status: "not_full" as const };
  if (recruitment.view.matchId) return { status: "already_created" as const, matchId: recruitment.view.matchId };

  const admin = createSupabaseAdminClient();
  const { data: actor, error: actorError } = await admin.from("profiles").select("id,role").eq("telegram_user_id", input.actorTelegramUserId).maybeSingle();
  if (actorError) fail("Telegram 대전 생성 관리자 조회 실패", actorError);
  if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) return { status: "not_authorized" as const };

  const telegramUserIds = recruitment.view.votes.map((vote) => vote.telegramUserId);
  const { data: profiles, error: profileError } = await admin.from("profiles").select("telegram_user_id,players(id,nickname,tier,rank_points,preferred_positions,is_active)").in("telegram_user_id", telegramUserIds);
  if (profileError) fail("Telegram 참가자 계정 조회 실패", profileError);
  const linkedPlayers = (profiles ?? []).flatMap((profile) => {
    const player = profile.players as unknown as { id: number | string; nickname: string; tier: number; rank_points: number | string; preferred_positions: string[]; is_active: boolean } | null;
    return player ? [{ telegramUserId: Number(profile.telegram_user_id), id: Number(player.id), nickname: player.nickname, tier: Number(player.tier), points: Number(player.rank_points), positions: normalizePlayerPositions(player.preferred_positions ?? []) ?? [], active: player.is_active } satisfies LinkedTelegramPlayer] : [];
  });
  const teams = prepareTelegramTeams(recruitment.view.votes, linkedPlayers);
  if (!teams.ok) return { status: "invalid_participants" as const, participants: teams.invalidParticipants };
  const { teamA, teamB, difference, teamAScore, teamBScore } = teams;
  const assignments = [...teamA.map((player) => ({ playerId: player.id, team: "A", separatedGroup: null })), ...teamB.map((player) => ({ playerId: player.id, team: "B", separatedGroup: null }))];
  const scheduledAt = recruitmentScheduledAt(recruitment.view.scheduledDate, recruitment.view.hour);
  const { data, error } = await admin.rpc("create_telegram_schedule", { p_recruitment_id: recruitment.view.id, p_scheduled_at: scheduledAt, p_map: "증강 칼바람 협곡", p_created_by: actor.id, p_assignments: assignments });
  if (error || !data) fail("Telegram 대전 예정 생성 실패", error);
  const created = data as { matchId: number | string; created: boolean };
  revalidateTag("matches", { expire: 0 });
  if (!created.created) return { status: "already_created" as const, matchId: Number(created.matchId) };
  return { status: "created" as const, matchId: Number(created.matchId), scheduledAt, teamA, teamB, difference, teamAScore, teamBScore };
}

async function saveVoteForRecruitment(row: RecruitmentRow, input: { telegramUserId: number; displayName: string; username: string | null; cancel: boolean }) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("save_telegram_recruitment_vote", {
    p_recruitment_id: row.id,
    p_chat_id: row.chat_id,
    p_scheduled_date: row.scheduled_date,
    p_telegram_user_id: input.telegramUserId,
    p_display_name: input.displayName,
    p_username: input.username ?? "",
    p_cancel: input.cancel,
  });
  if (error) fail("Telegram 참여 저장 실패", error);
  const result = data as { status: "saved" | "full" | "locked" | "not_found"; recruitmentStatus?: "open" | "full"; becameFull?: boolean };
  if (result.status === "not_found") return null;
  if (result.status === "full") row.status = "full";
  else if (result.recruitmentStatus) row.status = result.recruitmentStatus;
  const view = await recruitmentView(row);
  return { row, view, accepted: result.status === "saved", becameFull: result.becameFull === true, locked: result.status === "locked" };
}

export async function saveRecruitmentVote(input: { chatId: number; scheduledDate: string; telegramUserId: number; displayName: string; username: string | null; hour: number; cancel: boolean }) {
  const row = await recruitmentAt(input.chatId, input.scheduledDate, input.hour);
  return row ? saveVoteForRecruitment(row, input) : null;
}

export async function saveRecruitmentVoteById(input: { chatId: number; scheduledDate: string; recruitmentId: number; telegramUserId: number; displayName: string; username: string | null; cancel: boolean }) {
  const recruitment = await getRecruitmentById(input.chatId, input.scheduledDate, input.recruitmentId);
  return recruitment ? saveVoteForRecruitment(recruitment.row, input) : null;
}
