import { unlinkTelegramAccount } from "../../../../db/telegram-recruitments";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");
  if (!(await takeRateLimit("telegram-link-v2", user.id, 20, 600))) return redirectWithToast(request, "/profile", "error", "연동 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  await unlinkTelegramAccount(user.id);
  return redirectWithToast(request, "/profile", "success", "치증 계정의 Telegram 연동을 해제했습니다.");
}
