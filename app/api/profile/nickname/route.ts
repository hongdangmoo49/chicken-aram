import { getPlayerProfile, getPlayers, setPlayerNickname } from "../../../../db/site-data";
import { redirectWithToast } from "../../../../lib/toast-response";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectWithToast(request, "/login", "error", "로그인이 필요합니다.");

  const form = await request.formData();
  const nickname = String(form.get("nickname") ?? "").trim();
  if (!nickname || nickname.length > 30) {
    return redirectWithToast(request, "/profile", "error", "닉네임은 1~30자로 입력해 주세요.");
  }

  const [profile, players] = await Promise.all([getPlayerProfile(user.id), getPlayers()]);
  if (!profile) return redirectWithToast(request, "/profile", "error", "프로필을 찾을 수 없습니다.");
  if (players.some((player) => player.id !== profile.id && player.nickname.toLowerCase() === nickname.toLowerCase())) {
    return redirectWithToast(request, "/profile", "error", "이미 사용 중인 닉네임입니다.");
  }

  try {
    await setPlayerNickname(user.id, nickname);
  } catch (error) {
    if (error instanceof Error && error.message.includes("players_nickname_lower_key")) {
      return redirectWithToast(request, "/profile", "error", "이미 사용 중인 닉네임입니다.");
    }
    throw error;
  }
  return redirectWithToast(request, "/profile", "success", "닉네임을 변경했습니다.");
}
