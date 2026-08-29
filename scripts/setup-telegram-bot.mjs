const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!token || !secret || !siteUrl) throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_SITE_URL are required.");

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram ${method} failed: ${result.description ?? response.status}`);
  return result.result;
}

await telegram("setMyName", { name: "치증봇" });
await telegram("setMyDescription", { description: "치킨증바람 모집을 만들고 시간별 참가자를 확인하는 봇입니다." });
await telegram("setMyCommands", { commands: [
  { command: "create", description: "오늘 시간별 모집 만들기: /create 9" },
  { command: "vote", description: "시간별 모집 참여: /vote 9" },
  { command: "cancle", description: "시간별 참여 취소: /cancle 9" },
  { command: "result", description: "경기 결과 등록: /result 9 3 1" },
  { command: "list", description: "현재 모집과 참여자 보기" },
  { command: "help", description: "치증봇 사용법" },
] });
await telegram("setWebhook", { url: `${siteUrl.replace(/\/$/, "")}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message", "callback_query"] });
process.stdout.write("치증봇 webhook과 명령어 설정을 완료했습니다.\n");
