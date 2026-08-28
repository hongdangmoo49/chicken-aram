import "server-only";

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };
type TelegramInlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type TelegramInlineKeyboard = { inline_keyboard: TelegramInlineButton[][] };

function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return token;
}

async function callTelegram<T>(method: string, body: Record<string, unknown>, ignoreNotModified = false): Promise<T | null> {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json() as TelegramResponse<T>;
  if (!result.ok) {
    if (ignoreNotModified && result.description?.includes("message is not modified")) return null;
    throw new Error(`Telegram ${method} failed: ${result.description ?? response.status}`);
  }
  return result.result ?? null;
}

export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: TelegramInlineKeyboard) {
  return callTelegram<{ message_id: number }>("sendMessage", { chat_id: chatId, text: text.slice(0, 4096), ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

export async function editTelegramMessage(chatId: number, messageId: number, text: string, replyMarkup?: TelegramInlineKeyboard) {
  return callTelegram("editMessageText", { chat_id: chatId, message_id: messageId, text: text.slice(0, 4096), ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }, true);
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  return callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

export async function isTelegramChatAdmin(chatId: number, userId: number) {
  const member = await callTelegram<{ status: string }>("getChatMember", { chat_id: chatId, user_id: userId });
  return member?.status === "creator" || member?.status === "administrator";
}
