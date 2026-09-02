export type TelegramCommand = { name: "create" | "vote" | "cancle" | "list" | "result" | "profile" | "nickname" | "help" | "start"; argument: string };
export type RecruitmentVoteView = { telegramUserId: number; displayName: string; username: string | null };
export type RecruitmentView = { id: number; scheduledDate: string; hour: number; status: "open" | "full"; targetCount: number; matchId: number | null; votes: RecruitmentVoteView[] };

export function parseTelegramCommand(text: string): TelegramCommand | null {
  const [raw = "", ...arguments_] = text.trim().split(/\s+/);
  if (!raw.startsWith("/")) return null;
  const name = raw.slice(1).split("@")[0].toLowerCase();
  if (name !== "create" && name !== "vote" && name !== "cancle" && name !== "list" && name !== "result" && name !== "profile" && name !== "nickname" && name !== "help" && name !== "start") return null;
  return { name, argument: arguments_.join(" ") } as TelegramCommand;
}

export function parseTelegramLinkToken(value: string) {
  return /^link_([A-Za-z0-9_-]{32})$/.exec(value)?.[1] ?? null;
}

export function parseVoteHour(value: string) {
  if (!/^\d{1,2}$/.test(value)) return null;
  const hour = Number(value);
  return hour >= 1 && hour <= 24 ? hour : null;
}

export function parseTelegramResult(value: string) {
  const [hourText, aScoreText, bScoreText, ...rest] = value.trim().split(/\s+/);
  const hour = parseVoteHour(hourText ?? "");
  if (rest.length || hour === null || !/^\d{1,2}$/.test(aScoreText ?? "") || !/^\d{1,2}$/.test(bScoreText ?? "")) return null;
  const aScore = Number(aScoreText);
  const bScore = Number(bScoreText);
  if (aScore === bScore) return null;
  return { hour, aScore, bScore, winner: aScore > bScore ? "A" as const : "B" as const };
}

export function recruitmentScheduledAt(scheduledDate: string, hour: number) {
  const midnight = new Date(`${scheduledDate}T00:00:00+09:00`);
  midnight.setTime(midnight.getTime() + hour * 60 * 60 * 1000);
  return midnight.toISOString();
}

function voterName(vote: RecruitmentVoteView) {
  return vote.username ? `${vote.displayName} (@${vote.username})` : vote.displayName;
}

export function formatRecruitment(recruitment: RecruitmentView) {
  const names = recruitment.votes.map((vote) => `- ${voterName(vote)}`).join("\n");
  return [
    `📢 ${recruitment.scheduledDate} ${recruitment.hour}시 치증 모집`,
    `${recruitment.status === "full" ? "✅ 모집 완료" : "모집 중"} · ${recruitment.votes.length}/${recruitment.targetCount}명`,
    ...(recruitment.matchId ? ["🏟 대전 예정 생성됨"] : []),
    "",
    names || "아직 참여자가 없습니다.",
    "",
    `참여: /vote ${recruitment.hour}`,
    `참여취소: /cancle ${recruitment.hour}`,
    "현재 목록: /list",
  ].join("\n");
}

export function formatRecruitmentList(recruitments: RecruitmentView[]) {
  return recruitments.length ? `오늘 치증 모집 ${recruitments.length}개\n시간을 선택하면 참가자를 확인할 수 있습니다.` : "오늘 치증 모집이 없습니다.";
}

export function helpMessage() {
  return ["치증봇 명령어", "/create 9 - 오늘 9시 모집 생성 (그룹 관리자)", "/vote 9 - 오늘 9시 모집 참여", "/cancle 9 - 오늘 9시 참여 취소", "/result 9 3 1 - A팀 3점, B팀 1점 결과 등록 (그룹 관리자)", "/list - 현재 모집과 참여자 조회", "/profile - 개인 채팅에서 내 프로필 조회·수정"].join("\n");
}

export function todayInKorea(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(date);
}
