import { createTelegramLink } from "../../../../db/telegram-recruitments";
import { reportError } from "../../../../lib/observability";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { getCurrentUser } from "../../../auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await takeRateLimit("telegram-link-v2", user.id, 20, 600))) return Response.json({ error: "연동 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  try {
    const token = await createTelegramLink(user.id);
    return Response.json({ url: `https://t.me/chicken_aram_bot?start=link_${token}` });
  } catch (error) {
    reportError("telegram.link.create", error, { userId: user.id });
    return Response.json({ error: "텔레그램 연동 링크를 만들지 못했습니다." }, { status: 500 });
  }
}
