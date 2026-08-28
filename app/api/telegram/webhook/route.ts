import { timingSafeEqual } from "node:crypto";
import { claimTelegramUpdate, createRecruitment, failRecruitment, listRecruitments, releaseTelegramUpdate, saveRecruitmentVote, setRecruitmentMessage } from "../../../../db/telegram-recruitments";
import { editTelegramMessage, isTelegramChatAdmin, sendTelegramMessage } from "../../../../lib/telegram-bot";
import { formatRecruitment, helpMessage, parseTelegramCommand, parseVoteHour, todayInKorea } from "../../../../lib/telegram-commands";
import { reportError } from "../../../../lib/observability";

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; first_name: string; last_name?: string; username?: string };
};
type TelegramUpdate = { update_id: number; message?: TelegramMessage };

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

async function handleMessage(message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const command = parseTelegramCommand(message.text);
  if (!command) return;
  const chatId = message.chat.id;
  const userId = message.from.id;
  if (message.chat.type !== "group" && message.chat.type !== "supergroup") return void await sendTelegramMessage(chatId, "치증봇은 텔레그램 그룹에서 사용해 주세요.");

  if (command.name === "help") return void await sendTelegramMessage(chatId, helpMessage());
  if (command.name === "create") {
    if (!(await isTelegramChatAdmin(chatId, userId))) return void await sendTelegramMessage(chatId, "그룹 관리자만 모집을 만들 수 있습니다.");
    const hour = parseVoteHour(command.argument);
    if (hour === null) return void await sendTelegramMessage(chatId, "사용법: /create 9");
    const { recruitment, created } = await createRecruitment(chatId, userId, todayInKorea(), hour);
    const current = (await listRecruitments(chatId)).find(({ row }) => Number(row.id) === Number(recruitment.id));
    if (!current) throw new Error("Created Telegram recruitment was not found.");
    if (!created) return void await sendTelegramMessage(chatId, `이미 진행 중인 모집이 있습니다.\n\n${formatRecruitment(current.view)}`);
    try {
      const sent = await sendTelegramMessage(chatId, formatRecruitment(current.view));
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
    if (result.row.message_id) await editTelegramMessage(chatId, Number(result.row.message_id), text);
    else await sendTelegramMessage(chatId, text);
    if (result.becameFull) await sendTelegramMessage(chatId, `✅ 오늘 ${hour}시 치증 참가자 10명이 모두 모였습니다.`);
    return;
  }

  const recruitments = await listRecruitments(chatId);
  return void await sendTelegramMessage(chatId, recruitments.length ? recruitments.map(({ view }) => formatRecruitment(view)).join("\n\n────────\n\n") : "현재 진행 중인 치증 모집이 없습니다.");
}

export async function POST(request: Request) {
  if (!validWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Unauthorized", { status: 401 });
  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  if (!update || !Number.isSafeInteger(update.update_id)) return new Response("Bad Request", { status: 400 });
  if (!(await claimTelegramUpdate(update.update_id))) return Response.json({ ok: true });
  try {
    if (update.message) await handleMessage(update.message);
    return Response.json({ ok: true });
  } catch (error) {
    await releaseTelegramUpdate(update.update_id);
    reportError("telegram.webhook", error, { updateId: update.update_id });
    return new Response("Retry", { status: 500 });
  }
}
