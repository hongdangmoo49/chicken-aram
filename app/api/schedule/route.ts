import { NextResponse } from "next/server";
import { createSchedule } from "../../../db/site-data";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isAdmin } from "../../roles";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  if (!isAdmin(user.email)) return new Response("관리자 권한이 필요합니다.", { status: 403 });

  const form = await request.formData();
  const scheduledAt = String(form.get("scheduledAt") ?? "").trim();
  const teamRed = String(form.get("teamRed") ?? "").trim();
  const teamBlue = String(form.get("teamBlue") ?? "").trim();
  const map = String(form.get("map") ?? "증강 칼바람 협곡").trim();
  if (!scheduledAt || !teamRed || !teamBlue || teamRed.length > 40 || teamBlue.length > 40 || Number.isNaN(Date.parse(scheduledAt))) {
    return new Response("입력값을 확인해 주세요.", { status: 400 });
  }

  await createSchedule({ scheduledAt: new Date(scheduledAt).toISOString(), teamRed, teamBlue, map, createdBy: user.email });
  return NextResponse.redirect(new URL("/schedule", request.url), 303);
}
