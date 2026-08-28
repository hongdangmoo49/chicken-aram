import { linkTelegramAccount } from "../../../../db/telegram-recruitments";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { verifyTelegramLogin } from "../../../../lib/telegram-login";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "올바르지 않은 요청입니다." }, { status: 403 });
  if (!(await takeRateLimit("telegram-link", user.id, 5, 600))) return Response.json({ error: "연동 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const telegram = verifyTelegramLogin(await request.json().catch(() => null), process.env.TELEGRAM_BOT_TOKEN ?? "");
  if (!telegram) return Response.json({ error: "텔레그램 인증값이 올바르지 않거나 만료되었습니다." }, { status: 400 });
  if (!(await linkTelegramAccount(user.id, telegram.userId, telegram.username))) return Response.json({ error: "이 텔레그램 계정은 이미 다른 치증 계정과 연동되어 있습니다." }, { status: 409 });
  return Response.json({ ok: true });
}
