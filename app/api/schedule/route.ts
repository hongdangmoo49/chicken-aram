import { NextResponse } from "next/server";
import { createBalancedSchedule } from "../../../db/site-data";
import { getCurrentUser } from "../../auth";
import { isAdmin } from "../../roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  if (!(await isAdmin(user.id))) return new Response("관리자 권한이 필요합니다.", { status: 403 });

  const form = await request.formData();
  const scheduledAt = String(form.get("scheduledAt") ?? "").trim();
  const map = String(form.get("map") ?? "증강 칼바람 협곡").trim();
  const playerIds = [...new Set(form.getAll("players").map(Number).filter(Number.isInteger))];
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt)) || playerIds.length !== 10) return new Response("일시와 참가 선수 10명을 확인해 주세요.", { status: 400 });

  const groups = new Map<number, number[]>();
  for (const playerId of playerIds) {
    const group = Number(form.get(`group_${playerId}`));
    if (Number.isInteger(group) && group >= 1 && group <= 5) groups.set(group, [...(groups.get(group) ?? []), playerId]);
  }

  try {
    await createBalancedSchedule({ scheduledAt: new Date(scheduledAt).toISOString(), map, playerIds, separatedGroups: [...groups.values()], createdBy: user.id });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "팀을 나누지 못했습니다.", { status: 400 });
  }
  return NextResponse.redirect(new URL("/schedule", request.url), 303);
}
