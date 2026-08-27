import { castMvpVote } from "../../../../db/site-data";
import { reportError } from "../../../../lib/observability";
import { takeRateLimit } from "../../../../lib/rate-limit";
import { getCurrentUser } from "../../../auth";

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await takeRateLimit("mvp-vote", user.id, 30, 600))) return Response.json({ error: "투표 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const matchId = Number((await params).matchId);
  const body = await request.json().catch(() => null) as { candidatePlayerId?: unknown } | null;
  const candidatePlayerId = Number(body?.candidatePlayerId);
  if (!Number.isInteger(matchId) || matchId < 1 || !Number.isInteger(candidatePlayerId) || candidatePlayerId < 1) return Response.json({ error: "MVP 후보를 확인해 주세요." }, { status: 400 });
  try {
    await castMvpVote({ matchId, candidatePlayerId, actorId: user.id });
    return Response.json({ ok: true });
  } catch (error) {
    const errorId = reportError("mvp-vote.cast", error, { matchId, candidatePlayerId });
    return Response.json({ error: `MVP 투표를 저장하지 못했습니다. 오류 번호: ${errorId.slice(0, 8)}` }, { status: 400 });
  }
}
