import { NextResponse } from "next/server";
import { claimPlayer, getPlayerProfile } from "../../../../db/site-data";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  if (await getPlayerProfile(user.id)) return new Response("이미 선수 프로필이 연결되어 있습니다.", { status: 409 });
  const form = await request.formData();
  const playerId = Number(form.get("playerId"));
  if (!Number.isInteger(playerId) || playerId < 1) return new Response("선수를 선택해 주세요.", { status: 400 });
  try {
    await claimPlayer(user.id, playerId);
  } catch {
    return new Response("이미 다른 계정에 연결된 선수입니다.", { status: 409 });
  }
  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
