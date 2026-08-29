import { timingSafeEqual } from "node:crypto";
import { claimTelegramUpdate, consumeTelegramLink, createRecruitment, createScheduleFromRecruitment, failRecruitment, getRecruitmentById, listRecruitments, releaseTelegramUpdate, removeRecruitment, saveRecruitmentVote, saveRecruitmentVoteById, setRecruitmentMessage } from "../../../../db/telegram-recruitments";
import { castTelegramMvpVote, saveTelegramMatchResult, syncTelegramMvpMessage } from "../../../../db/telegram-mvp";
import { answerTelegramCallback, editTelegramMessage, isTelegramChatAdmin, sendTelegramMessage, type TelegramInlineKeyboard } from "../../../../lib/telegram-bot";
import { formatRecruitment, formatRecruitmentList, helpMessage, parseTelegramCommand, parseTelegramLinkToken, parseTelegramResult, parseVoteHour, todayInKorea, type RecruitmentView } from "../../../../lib/telegram-commands";
import { reportError } from "../../../../lib/observability";
import { siteUrl } from "../../../../lib/site-url";

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
  return { inline_keyboard: recruitments.map((recruitment) => [{ text: `${recruitment.hour}시${recruitment.matchId ? " · 대전 생성됨" : recruitment.status === "full" ? " · 모집 완료" : ""} · ${recruitment.votes.length}/${recruitment.targetCount}명`, callback_data: `recruit:view:${recruitment.id}` }]) };
}

function detailKeyboard(recruitment: RecruitmentView): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inline_keyboard"] = [];
  if (recruitment.matchId) rows.push([{ text: "🏟 대전 예정에서 확인", url: `${siteUrl}/schedule#match-${recruitment.matchId}` }]);
  else if (recruitment.status === "full") rows.push([{ text: "🏟 대전 예정 생성", callback_data: `recruit:schedule:${recruitment.id}` }], [{ text: "❌ 참여 취소", callback_data: `recruit:cancel:${recruitment.id}` }]);
  else rows.push([{ text: "✅ 참여하기", callback_data: `recruit:vote:${recruitment.id}` }, { text: "❌ 참여 취소", callback_data: `recruit:cancel:${recruitment.id}` }]);
  if (!recruitment.matchId) rows.push([{ text: "🗑 모집 삭제", callback_data: `recruit:delete:${recruitment.id}` }]);
  rows.push([{ text: "⬅️ 오늘 모집 목록", callback_data: "recruit:list" }]);
  return { inline_keyboard: rows };
}

function deleteConfirmationKeyboard(recruitmentId: number): TelegramInlineKeyboard {
  return { inline_keyboard: [[{ text: "⚠️ 모집 삭제 확인", callback_data: `recruit:delete-confirm:${recruitmentId}` }], [{ text: "취소", callback_data: `recruit:view:${recruitmentId}` }]] };
}

function createdScheduleText(result: Extract<Awaited<ReturnType<typeof createScheduleFromRecruitment>>, { status: "created" }>) {
  return [`✅ 대전 예정 생성 완료`, "", `A팀 · 랭크 ${result.teamAScore}점`, result.teamA.map((player) => player.nickname).join(" · "), "", `B팀 · 랭크 ${result.teamBScore}점`, result.teamB.map((player) => player.nickname).join(" · "), "", `팀 점수 차이 ${result.difference}점`].join("\n");
}

async function handleMessage(message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const command = parseTelegramCommand(message.text);
  if (!command) return;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const linkToken = command.name === "start" ? parseTelegramLinkToken(command.argument) : null;
  if (linkToken) {
    if (message.chat.type !== "private") return void await sendTelegramMessage(chatId, "계정 연동 링크는 치증봇 개인 채팅에서 열어 주세요.");
    const linked = await consumeTelegramLink(linkToken, userId, message.from.username ?? null);
    if (linked.status === "invalid") return void await sendTelegramMessage(chatId, "연동 링크가 만료되었거나 올바르지 않습니다. 치증 사이트에서 다시 시도해 주세요.");
    if (linked.status === "already_linked") return void await sendTelegramMessage(chatId, "이 텔레그램 계정은 이미 다른 치증 계정과 연동되어 있습니다.");
    return void await sendTelegramMessage(chatId, `✅ ${linked.displayName} 치증 계정과 연동했습니다. 이제 텔레그램 투표가 해당 계정에 귀속됩니다.`);
  }
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
      const sent = await sendTelegramMessage(chatId, formatRecruitment(current.view), detailKeyboard(current.view));
      if (!sent) throw new Error("Telegram recruitment message was not returned.");
      await setRecruitmentMessage(Number(recruitment.id), sent.message_id);
    } catch (error) {
      await failRecruitment(Number(recruitment.id));
      throw error;
    }
    return;
  }

  if (command.name === "result") {
    if (!(await isTelegramChatAdmin(chatId, userId))) return void await sendTelegramMessage(chatId, "Telegram 그룹 관리자만 경기 결과를 등록할 수 있습니다.");
    const resultInput = parseTelegramResult(command.argument);
    if (!resultInput) return void await sendTelegramMessage(chatId, "사용법: /result 21 3 1 (A팀 3점, B팀 1점)");
    const result = await saveTelegramMatchResult({ chatId, scheduledDate: todayInKorea(), telegramUserId: userId, ...resultInput });
    if (result.status === "not_found") return void await sendTelegramMessage(chatId, `오늘 ${resultInput.hour}시에 Telegram에서 생성한 대전을 찾을 수 없습니다.`);
    if (result.status === "not_authorized") return void await sendTelegramMessage(chatId, "사이트 관리자 계정과 Telegram을 연동해 주세요.");
    await syncTelegramMvpMessage(result.matchId);
    if (result.status === "already_completed") return void await sendTelegramMessage(chatId, "이미 결과가 등록된 경기입니다. MVP 투표 메시지를 갱신했습니다.");
    return void await sendTelegramMessage(chatId, [`✅ 경기 결과 등록 완료`, "", `A팀 ${result.aScore} : ${result.bScore} B팀`, `승리팀: ${result.winner}팀`, "", `A팀 · ${result.teamA.join(" · ")}`, `B팀 · ${result.teamB.join(" · ")}`, "", "MVP 투표를 시작했습니다."].join("\n"));
  }

  if (command.name === "vote" || command.name === "cancle") {
    const hour = parseVoteHour(command.argument);
    if (hour === null) return void await sendTelegramMessage(chatId, `사용법: /${command.name} 9`);
    const result = await saveRecruitmentVote({ chatId, scheduledDate: todayInKorea(), telegramUserId: userId, displayName: displayName(message.from), username: message.from.username ?? null, hour, cancel: command.name === "cancle" });
    if (!result) return void await sendTelegramMessage(chatId, `오늘 ${hour}시에 진행 중인 모집이 없습니다. 관리자가 /create ${hour}로 만들어야 합니다.`);
    if (result.locked) return void await sendTelegramMessage(chatId, "대전 예정이 이미 생성되어 참가자를 변경할 수 없습니다. 사이트에서 수정해 주세요.");
    if (!result.accepted) return void await sendTelegramMessage(chatId, `오늘 ${hour}시 모집은 이미 10명이 모두 모였습니다.`);
    const text = formatRecruitment(result.view);
    if (result.row.message_id) await editTelegramMessage(chatId, Number(result.row.message_id), text, detailKeyboard(result.view));
    else await sendTelegramMessage(chatId, text);
    if (result.becameFull) await sendTelegramMessage(chatId, `✅ 오늘 ${hour}시 치증 참가자 10명이 모두 모였습니다.\n관리자가 대전 예정을 생성해 주세요.`, detailKeyboard(result.view));
    return;
  }

  const recruitments = await listRecruitments(chatId, todayInKorea());
  const views = recruitments.map(({ view }) => view);
  return void await sendTelegramMessage(chatId, formatRecruitmentList(views), views.length ? listKeyboard(views) : undefined);
}

async function handleCallback(query: TelegramCallbackQuery) {
  const message = query.message;
  if (!message || !query.data || (message.chat.type !== "group" && message.chat.type !== "supergroup")) return void await answerTelegramCallback(query.id, "사용할 수 없는 버튼입니다.");
  const chatId = message.chat.id;
  const scheduledDate = todayInKorea();
  const mvpMatch = /^mvp:(\d+):(\d+)$/.exec(query.data);
  if (mvpMatch) {
    const matchId = Number(mvpMatch[1]);
    const candidatePlayerId = Number(mvpMatch[2]);
    const result = await castTelegramMvpVote({ matchId, candidatePlayerId, telegramUserId: query.from.id, chatId });
    if (result.status === "unlinked") return void await answerTelegramCallback(query.id, "치증 사이트에서 Telegram 계정을 연동해 주세요.");
    if (result.status === "rejected") return void await answerTelegramCallback(query.id, "본인이 참가한 경기의 상대팀 선수에게만 투표할 수 있습니다.");
    await answerTelegramCallback(query.id, "MVP 투표를 저장했습니다.");
    await syncTelegramMvpMessage(matchId);
    return;
  }
  if (query.data === "recruit:list") {
    const views = (await listRecruitments(chatId, scheduledDate)).map(({ view }) => view);
    await editTelegramMessage(chatId, message.message_id, formatRecruitmentList(views), listKeyboard(views));
    return void await answerTelegramCallback(query.id);
  }

  const match = /^recruit:(view|vote|cancel|schedule|delete|delete-confirm):(\d+)$/.exec(query.data);
  if (!match) return void await answerTelegramCallback(query.id, "잘못된 모집 버튼입니다.");
  const action = match[1];
  const recruitmentId = Number(match[2]);
  if (action === "view") {
    const recruitment = await getRecruitmentById(chatId, scheduledDate, recruitmentId);
    if (!recruitment) return void await answerTelegramCallback(query.id, "오늘 진행 중인 모집이 아닙니다.");
    await editTelegramMessage(chatId, message.message_id, formatRecruitment(recruitment.view), detailKeyboard(recruitment.view));
    return void await answerTelegramCallback(query.id);
  }

  if (action === "delete" || action === "delete-confirm") {
    if (!(await isTelegramChatAdmin(chatId, query.from.id))) return void await answerTelegramCallback(query.id, "Telegram 그룹 관리자만 삭제할 수 있습니다.");
    const recruitment = await getRecruitmentById(chatId, scheduledDate, recruitmentId);
    if (!recruitment) return void await answerTelegramCallback(query.id, "오늘 모집을 찾을 수 없습니다.");
    if (recruitment.view.matchId) return void await answerTelegramCallback(query.id, "대전 예정이 생성된 모집은 삭제할 수 없습니다.");
    if (action === "delete") {
      await editTelegramMessage(chatId, message.message_id, `${formatRecruitment(recruitment.view)}\n\n⚠️ 이 모집을 삭제하시겠습니까?`, deleteConfirmationKeyboard(recruitmentId));
      return void await answerTelegramCallback(query.id);
    }
    const removed = await removeRecruitment(chatId, scheduledDate, recruitmentId);
    if (!removed) return void await answerTelegramCallback(query.id, "모집을 삭제하지 못했습니다.");
    const deletedText = `🗑 ${removed.scheduled_date} ${removed.hour}시 치증 모집이 삭제되었습니다.`;
    if (removed.message_id) await editTelegramMessage(chatId, Number(removed.message_id), deletedText, { inline_keyboard: [] });
    if (Number(removed.message_id) !== message.message_id) await editTelegramMessage(chatId, message.message_id, deletedText, { inline_keyboard: [[{ text: "⬅️ 오늘 모집 목록", callback_data: "recruit:list" }]] });
    return void await answerTelegramCallback(query.id, "모집을 삭제했습니다.");
  }

  if (action === "schedule") {
    if (!(await isTelegramChatAdmin(chatId, query.from.id))) return void await answerTelegramCallback(query.id, "Telegram 그룹 관리자만 생성할 수 있습니다.");
    const result = await createScheduleFromRecruitment({ chatId, scheduledDate, recruitmentId, actorTelegramUserId: query.from.id });
    if (result.status === "not_found") return void await answerTelegramCallback(query.id, "오늘 모집을 찾을 수 없습니다.");
    if (result.status === "not_full") return void await answerTelegramCallback(query.id, "참가자 10명이 모두 모여야 합니다.");
    if (result.status === "not_authorized") return void await answerTelegramCallback(query.id, "사이트 관리자 계정과 Telegram을 연동해 주세요.");
    if (result.status === "invalid_participants") {
      await sendTelegramMessage(chatId, [`⚠️ 대전을 생성할 수 없습니다.`, "", "사이트 연동 또는 선수 확인 필요:", ...result.participants.map((participant) => `- ${participant}`)].join("\n"), { inline_keyboard: [[{ text: "🔗 사이트에서 Telegram 연동", url: `${siteUrl}/profile` }]] });
      return void await answerTelegramCallback(query.id, "연동되지 않은 참가자가 있습니다.");
    }
    const current = await getRecruitmentById(chatId, scheduledDate, recruitmentId);
    if (current) {
      const text = formatRecruitment(current.view);
      const keyboard = detailKeyboard(current.view);
      if (current.row.message_id) await editTelegramMessage(chatId, Number(current.row.message_id), text, keyboard);
      if (Number(current.row.message_id) !== message.message_id) await editTelegramMessage(chatId, message.message_id, text, keyboard);
    }
    if (result.status === "already_created") return void await answerTelegramCallback(query.id, "이미 대전 예정이 생성되었습니다.");
    await answerTelegramCallback(query.id, "대전 예정을 생성했습니다.");
    return void await sendTelegramMessage(chatId, createdScheduleText(result), { inline_keyboard: [[{ text: "🌐 사이트에서 확인", url: `${siteUrl}/schedule#match-${result.matchId}` }]] });
  }

  const result = await saveRecruitmentVoteById({ chatId, scheduledDate, recruitmentId, telegramUserId: query.from.id, displayName: displayName(query.from), username: query.from.username ?? null, cancel: action === "cancel" });
  if (!result) return void await answerTelegramCallback(query.id, "오늘 진행 중인 모집이 아닙니다.");
  if (result.locked) return void await answerTelegramCallback(query.id, "대전 예정이 생성되어 참가자를 변경할 수 없습니다.");
  if (!result.accepted) return void await answerTelegramCallback(query.id, "이미 10명이 모두 모였습니다.");
  const text = formatRecruitment(result.view);
  const keyboard = detailKeyboard(result.view);
  if (result.row.message_id) await editTelegramMessage(chatId, Number(result.row.message_id), text, keyboard);
  if (Number(result.row.message_id) !== message.message_id) await editTelegramMessage(chatId, message.message_id, text, keyboard);
  await answerTelegramCallback(query.id, action === "cancel" ? "참여를 취소했습니다." : "참여했습니다.");
  if (result.becameFull) await sendTelegramMessage(chatId, `✅ 오늘 ${result.view.hour}시 치증 참가자 10명이 모두 모였습니다.\n관리자가 대전 예정을 생성해 주세요.`, detailKeyboard(result.view));
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
