import { NextResponse } from "next/server";
import { getPlayerProfile, getPlayers, setPlayerNickname } from "../../../../db/site-data";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });

  const form = await request.formData();
  const nickname = String(form.get("nickname") ?? "").trim();
  if (!nickname || nickname.length > 30) {
    return new Response("닉네임은 1~30자로 입력해 주세요.", { status: 400 });
  }

  const [profile, players] = await Promise.all([getPlayerProfile(user.id), getPlayers()]);
  if (!profile) return new Response("프로필을 찾을 수 없습니다.", { status: 404 });
  if (players.some((player) => player.id !== profile.id && player.nickname.toLowerCase() === nickname.toLowerCase())) {
    return new Response("이미 사용 중인 닉네임입니다.", { status: 409 });
  }

  try {
    await setPlayerNickname(user.id, nickname);
  } catch (error) {
    if (error instanceof Error && error.message.includes("players_nickname_lower_key")) {
      return new Response("이미 사용 중인 닉네임입니다.", { status: 409 });
    }
    throw error;
  }
  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
