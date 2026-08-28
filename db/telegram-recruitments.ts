import "server-only";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { RecruitmentView, RecruitmentVoteView } from "../lib/telegram-commands";

type RecruitmentRow = {
  id: number | string;
  chat_id: number | string;
  message_id: number | string | null;
  scheduled_date: string;
  hour: number;
  target_count: number;
  status: "open" | "full";
};

function fail(operation: string, error: { message: string } | null): never {
  throw new Error(`${operation}: ${error?.message ?? "unknown Supabase error"}`);
}

export async function claimTelegramUpdate(updateId: number) {
  const { error } = await createSupabaseAdminClient().from("telegram_updates").insert({ update_id: updateId });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  fail("Telegram update 저장 실패", error);
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
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").select("id,chat_id,message_id,scheduled_date,hour,target_count,status").eq("chat_id", chatId).eq("scheduled_date", scheduledDate).eq("hour", hour).in("status", ["open", "full"]).maybeSingle();
  if (error) fail("Telegram 모집 조회 실패", error);
  return data as RecruitmentRow | null;
}

export async function createRecruitment(chatId: number, createdBy: number, scheduledDate: string, hour: number) {
  const existing = await recruitmentAt(chatId, scheduledDate, hour);
  if (existing) return { recruitment: existing, created: false };
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").insert({ chat_id: chatId, created_by: createdBy, scheduled_date: scheduledDate, hour }).select("id,chat_id,message_id,scheduled_date,hour,target_count,status").single();
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
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitment_votes").select("display_name,username").eq("recruitment_id", row.id).order("created_at");
  if (error) fail("Telegram 참여자 조회 실패", error);
  return { id: Number(row.id), scheduledDate: row.scheduled_date, hour: Number(row.hour), status: row.status, targetCount: Number(row.target_count), votes: (data ?? []).map((vote) => ({ displayName: vote.display_name, username: vote.username })) as RecruitmentVoteView[] };
}

export async function listRecruitments(chatId: number) {
  await expireRecruitments(chatId);
  const { data, error } = await createSupabaseAdminClient().from("telegram_recruitments").select("id,chat_id,message_id,scheduled_date,hour,target_count,status").eq("chat_id", chatId).in("status", ["open", "full"]).order("scheduled_date").order("hour");
  if (error) fail("Telegram 모집 목록 조회 실패", error);
  return Promise.all(((data ?? []) as RecruitmentRow[]).map(async (row) => ({ row, view: await recruitmentView(row) })));
}

export async function saveRecruitmentVote(input: { chatId: number; scheduledDate: string; telegramUserId: number; displayName: string; username: string | null; hour: number; cancel: boolean }) {
  const row = await recruitmentAt(input.chatId, input.scheduledDate, input.hour);
  if (!row) return null;
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin.from("telegram_recruitment_votes").select("telegram_user_id").eq("recruitment_id", row.id).eq("telegram_user_id", input.telegramUserId).maybeSingle();
  if (existingError) fail("Telegram 기존 참여 조회 실패", existingError);

  if (input.cancel) {
    const { error } = await admin.from("telegram_recruitment_votes").delete().eq("recruitment_id", row.id).eq("telegram_user_id", input.telegramUserId);
    if (error) fail("Telegram 참여 취소 실패", error);
  } else if (row.status === "full" && !existing) {
    return { row, view: await recruitmentView(row), accepted: false, becameFull: false };
  } else {
    const { error } = await admin.from("telegram_recruitment_votes").upsert({ recruitment_id: row.id, telegram_user_id: input.telegramUserId, display_name: input.displayName, username: input.username, updated_at: new Date().toISOString() }, { onConflict: "recruitment_id,telegram_user_id" });
    if (error) fail("Telegram 참여 저장 실패", error);
  }

  const view = await recruitmentView(row);
  const nextStatus = view.votes.length >= row.target_count ? "full" : "open";
  const becameFull = row.status !== "full" && nextStatus === "full";
  if (nextStatus !== row.status) {
    const { error } = await admin.from("telegram_recruitments").update({ status: nextStatus }).eq("id", row.id);
    if (error) fail("Telegram 모집 상태 변경 실패", error);
    row.status = nextStatus;
    view.status = nextStatus;
  }
  return { row, view, accepted: true, becameFull };
}
