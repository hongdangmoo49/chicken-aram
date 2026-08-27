import { getMvpVotingContests } from "../../../db/site-data";
import { reportError } from "../../../lib/observability";
import { getCurrentUser } from "../../auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ contests: [] });
  try {
    return Response.json({ contests: await getMvpVotingContests(user.id) });
  } catch (error) {
    const errorId = reportError("mvp-vote.list", error);
    return Response.json({ error: `MVP 투표를 불러오지 못했습니다. 오류 번호: ${errorId.slice(0, 8)}` }, { status: 500 });
  }
}
