import { createTelegramLink } from "../../../../db/telegram-recruitments";
import { getTelegramBotUsername } from "../../../../lib/telegram-bot";
import { reportError } from "../../../../lib/observability";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await takeRateLimit("telegram-link", user.id, 5, 600))) return redirectWithToast(request, "/profile", "error", "연동 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");

  try {
    const [botUsername, token] = await Promise.all([getTelegramBotUsername(), createTelegramLink(user.id)]);
    return Response.redirect(`https://t.me/${botUsername}?start=link_${token}`, 303);
  } catch (error) {
    reportError("telegram.link.create", error, { userId: user.id });
    return redirectWithToast(request, "/profile", "error", "텔레그램 연동 링크를 만들지 못했습니다.");
  }
}
