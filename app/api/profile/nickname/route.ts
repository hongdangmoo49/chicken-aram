import { NextResponse } from "next/server";
import { setPlayerNickname } from "../../../../db/site-data";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });

  const form = await request.formData();
  const nickname = String(form.get("nickname") ?? "").trim();
  if (!nickname || nickname.length > 30) {
    return new Response("닉네임은 1~30자로 입력해 주세요.", { status: 400 });
  }

  await setPlayerNickname(user.id, nickname);
  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
