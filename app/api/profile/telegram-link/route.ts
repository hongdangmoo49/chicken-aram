import { linkTelegramAccount } from "../../../../db/telegram-recruitments";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { verifyTelegramLogin, verifyTelegramLoginState } from "../../../../lib/telegram-login";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await takeRateLimit("telegram-link", user.id, 5, 600))) return redirectWithToast(request, "/profile", "error", "연동 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!verifyTelegramLoginState(String(params.state ?? ""), user.id, botToken)) return redirectWithToast(request, "/profile", "error", "텔레그램 연동 요청이 만료되었습니다. 다시 시도해 주세요.");
  const telegram = verifyTelegramLogin(params, botToken);
  if (!telegram) return redirectWithToast(request, "/profile", "error", "텔레그램 인증값이 올바르지 않거나 만료되었습니다.");
  if (!(await linkTelegramAccount(user.id, telegram.userId, telegram.username))) return redirectWithToast(request, "/profile", "error", "이 텔레그램 계정은 이미 다른 치증 계정과 연동되어 있습니다.");
  return redirectWithToast(request, "/profile", "success", "텔레그램 계정을 연동했습니다.");
}
