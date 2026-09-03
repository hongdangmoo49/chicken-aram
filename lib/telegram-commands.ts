export type TelegramCommand = { name: "create" | "vote" | "cancle" | "list" | "result" | "profile" | "nickname" | "help" | "start"; argument: string };
export type RecruitmentVoteView = { telegramUserId: number; displayName: string; username: string | null };
export type RecruitmentView = { id: number; scheduledDate: string; hour: number; status: "open" | "full" | "expired" | "failed"; targetCount: number; matchId: number | null; matchStatus?: "scheduled" | "completed" | null; votes: RecruitmentVoteView[] };

export const telegramWelcomeMessage = [
  "치킨증바람방에 오신 걸 환영합니다!",
  "",
  "처음 들어오셨다면 치증 사이트 (https://chicken-aram.vercel.app/) 및 디스코드채널 (https://discord.gg/cjQ987bEh) 가입 후 텔레그램 계정을 연동해주세요.",
  "",
  "아래는 치킨증바람방의 기본 게임 규칙입니다.",
  "",
  "게임 규칙",
  "",
  "1) 경기 방식",
  "치증방은 기본적으로 5판 3선승제(BO5)로 진행합니다.",
  "",
  "2) 닷지 규칙",
  "양 팀은 총 5판 중 각각 1회씩 닷지할 수 있습니다.",
  "",
  "3) 5꽉 진영 선택",
  "경기가 2:2까지 가서 마지막 5세트까지 진행될 경우,",
  "양 팀 대표자의 가위바위보를 통해 마지막 판 진영을 결정합니다.",
  "",
  "4) MVP 투표",
  "게임 종료 후에는 텔레그램방에서 반드시 MVP 투표를 진행해주세요.",
  "",
  "5) 치킨 지급",
  "게임 종료 후 치킨은 배달의민족 / 쿠팡이츠 2만원 상품권으로 각자 지급해주시면 됩니다.",
  "",
  "6) 마이크 필수",
  "게임 중 원활한 소통을 위해 마이크 사용은 필수입니다.",
  "",
  "7) 피드백 및 비난 관련 규칙",
  "게임의 퀄리티를 높이기 위한 강도 높은 피드백은 허용합니다.",
  "다만, 감정적인 욕설이나 원색적인 비난은 삼가주세요.",
  "",
  "❌ XX님 진짜 줱같이 못하시네요.",
  "⭕ XX님 지금 너무 던지고 계신데 집중해주세요.",
  "",
  "재밌게 게임하되, 서로 기본적인 선은 지켜주세요.",
].join("\n");

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
  const status = recruitment.matchStatus === "completed" ? "🏁 경기 종료" : recruitment.matchId ? "🏟 대전 예정 생성됨" : recruitment.status === "full" ? "✅ 모집 완료" : "모집 중";
  return [
    `📢 ${recruitment.scheduledDate} ${recruitment.hour}시 치증 모집`,
    `${status} · ${recruitment.votes.length}/${recruitment.targetCount}명`,
    "",
    names || "아직 참여자가 없습니다.",
    "",
    ...(recruitment.matchId ? [] : [`참여: /vote ${recruitment.hour}`, `참여취소: /cancle ${recruitment.hour}`]),
    "현재 목록: /list",
  ].join("\n");
}

export function formatTelegramMatchResult(result: { aScore: number; bScore: number; winner: "A" | "B"; teamA: string[]; teamB: string[] }) {
  return ["✅ 경기 결과 등록 완료", "", `A팀 ${result.aScore} : ${result.bScore} B팀`, `승리팀: ${result.winner}팀`, "", `A팀 · ${result.teamA.join(" · ")}`, `B팀 · ${result.teamB.join(" · ")}`, "", "MVP 투표를 시작했습니다."].join("\n");
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
