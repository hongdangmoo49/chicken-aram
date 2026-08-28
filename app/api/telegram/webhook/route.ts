import { timingSafeEqual } from "node:crypto";
import { claimTelegramUpdate, createRecruitment, failRecruitment, getRecruitmentById, listRecruitments, releaseTelegramUpdate, saveRecruitmentVote, saveRecruitmentVoteById, setRecruitmentMessage } from "../../../../db/telegram-recruitments";
import { answerTelegramCallback, editTelegramMessage, isTelegramChatAdmin, sendTelegramMessage, type TelegramInlineKeyboard } from "../../../../lib/telegram-bot";
import { formatRecruitment, formatRecruitmentList, helpMessage, parseTelegramCommand, parseVoteHour, todayInKorea, votingRecruitments, type RecruitmentView } from "../../../../lib/telegram-commands";
import { reportError } from "../../../../lib/observability";

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; first_name: string; last_name?: string; username?: string };
};
type TelegramCallbackQuery = { id: string; data?: string; from: NonNullable<TelegramMessage["from"]>; message?: TelegramMessage };
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

function validWebhookSecret(value: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !value) return false;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function displayName(user: NonNullable<TelegramMessage["from"]>) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").slice(0, 100);
}

function listKeyboard(recruitments: RecruitmentView[]): TelegramInlineKeyboard {
  return { inline_keyboard: recruitments.map((recruitment) => [{ text: `${recruitment.hour}시 · ${recruitment.votes.length}/${recruitment.targetCount}명`, callback_data: `recruit:view:${recruitment.id}` }]) };
}

function detailKeyboard(recruitmentId: number): TelegramInlineKeyboard {
  return { inline_keyboard: [[
    { text: "✅ 참여하기", callback_data: `recruit:vote:${recruitmentId}` },
    { text: "❌ 참여 취소", callback_data: `recruit:cancel:${recruitmentId}` },
  ], [{ text: "⬅️ 오늘 모집 목록", callback_data: "recruit:list" }]] };
}

async function handleMessage(message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const command = parseTelegramCommand(message.text);
  if (!command) return;
  const chatId = message.chat.id;
  const userId = message.from.id;
  if (message.chat.type !== "group" && message.chat.type !== "supergroup") return void await sendTelegramMessage(chatId, "치증봇은 텔레그램 그룹에서 사용해 주세요.");

  if (command.name === "help" || command.name === "start") return void await sendTelegramMessage(chatId, helpMessage());
  if (command.name === "create") {
    if (!(await isTelegramChatAdmin(chatId, userId))) return void await sendTelegramMessage(chatId, "그룹 관리자만 모집을 만들 수 있습니다.");
    const hour = parseVoteHour(command.argument);
    if (hour === null) return void await sendTelegramMessage(chatId, "사용법: /create 9");
    const { recruitment, created } = await createRecruitment(chatId, userId, todayInKorea(), hour);
    const current = (await listRecruitments(chatId, todayInKorea())).find(({ row }) => Number(row.id) === Number(recruitment.id));
    if (!current) throw new Error("Created Telegram recruitment was not found.");
    if (!created) return void await sendTelegramMessage(chatId, `이미 진행 중인 모집이 있습니다.\n\n${formatRecruitment(current.view)}`);
    try {
      const sent = await sendTelegramMessage(chatId, formatRecruitment(current.view), detailKeyboard(current.view.id));
      if (!sent) throw new Error("Telegram recruitment message was not returned.");
      await setRecruitmentMessage(Number(recruitment.id), sent.message_id);
    } catch (error) {
      await failRecruitment(Number(recruitment.id));
      throw error;
    }
    return;
  }

  if (command.name === "vote" || command.name === "cancle") {
    const hour = parseVoteHour(command.argument);
    if (hour === null) return void await sendTelegramMessage(chatId, `사용법: /${command.name} 9`);
    const result = await saveRecruitmentVote({ chatId, scheduledDate: todayInKorea(), telegramUserId: userId, displayName: displayName(message.from), username: message.from.username ?? null, hour, cancel: command.name === "cancle" });
    if (!result) return void await sendTelegramMessage(chatId, `오늘 ${hour}시에 진행 중인 모집이 없습니다. 관리자가 /create ${hour}로 만들어야 합니다.`);
    if (!result.accepted) return void await sendTelegramMessage(chatId, `오늘 ${hour}시 모집은 이미 10명이 모두 모였습니다.`);
    const text = formatRecruitment(result.view);
    if (result.row.message_id) await editTelegramMessage(chatId, Number(result.row.message_id), text, detailKeyboard(result.view.id));
    else await sendTelegramMessage(chatId, text);
    if (result.becameFull) await sendTelegramMessage(chatId, `✅ 오늘 ${hour}시 치증 참가자 10명이 모두 모였습니다.`);
    return;
  }

  const recruitments = await listRecruitments(chatId, todayInKorea());
  const views = votingRecruitments(recruitments.map(({ view }) => view));
  return void await sendTelegramMessage(chatId, formatRecruitmentList(views), views.length ? listKeyboard(views) : undefined);
}

async function handleCallback(query: TelegramCallbackQuery) {
  const message = query.message;
  if (!message || !query.data || (message.chat.type !== "group" && message.chat.type !== "supergroup")) return void await answerTelegramCallback(query.id, "사용할 수 없는 버튼입니다.");
  const chatId = message.chat.id;
  const scheduledDate = todayInKorea();
  if (query.data === "recruit:list") {
    const views = votingRecruitments((await listRecruitments(chatId, scheduledDate)).map(({ view }) => view));
    await editTelegramMessage(chatId, message.message_id, formatRecruitmentList(views), listKeyboard(views));
    return void await answerTelegramCallback(query.id);
  }

  const match = /^recruit:(view|vote|cancel):(\d+)$/.exec(query.data);
  if (!match) return void await answerTelegramCallback(query.id, "잘못된 모집 버튼입니다.");
  const action = match[1];
  const recruitmentId = Number(match[2]);
  if (action === "view") {
    const recruitment = await getRecruitmentById(chatId, scheduledDate, recruitmentId);
    if (!recruitment) return void await answerTelegramCallback(query.id, "오늘 진행 중인 모집이 아닙니다.");
    await editTelegramMessage(chatId, message.message_id, formatRecruitment(recruitment.view), detailKeyboard(recruitmentId));
    return void await answerTelegramCallback(query.id);
  }

  const result = await saveRecruitmentVoteById({ chatId, scheduledDate, recruitmentId, telegramUserId: query.from.id, displayName: displayName(query.from), username: query.from.username ?? null, cancel: action === "cancel" });
  if (!result) return void await answerTelegramCallback(query.id, "오늘 진행 중인 모집이 아닙니다.");
  if (!result.accepted) return void await answerTelegramCallback(query.id, "이미 10명이 모두 모였습니다.");
  const text = formatRecruitment(result.view);
  const keyboard = detailKeyboard(recruitmentId);
  if (result.row.message_id) await editTelegramMessage(chatId, Number(result.row.message_id), text, keyboard);
  if (Number(result.row.message_id) !== message.message_id) await editTelegramMessage(chatId, message.message_id, text, keyboard);
  await answerTelegramCallback(query.id, action === "cancel" ? "참여를 취소했습니다." : "참여했습니다.");
  if (result.becameFull) await sendTelegramMessage(chatId, `✅ 오늘 ${result.view.hour}시 치증 참가자 10명이 모두 모였습니다.`);
}

export async function POST(request: Request) {
  if (!validWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Unauthorized", { status: 401 });
  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  if (!update || !Number.isSafeInteger(update.update_id)) return new Response("Bad Request", { status: 400 });
  if (!(await claimTelegramUpdate(update.update_id))) return Response.json({ ok: true });
  try {
    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
    return Response.json({ ok: true });
  } catch (error) {
    await releaseTelegramUpdate(update.update_id);
    reportError("telegram.webhook", error, { updateId: update.update_id });
    return new Response("Retry", { status: 500 });
  }
}
