export type TelegramCommand = { name: "create" | "vote" | "cancle" | "list" | "help"; argument: string };
export type RecruitmentVoteView = { displayName: string; username: string | null };
export type RecruitmentView = { id: number; scheduledDate: string; hour: number; status: "open" | "full"; targetCount: number; votes: RecruitmentVoteView[] };

export function parseTelegramCommand(text: string): TelegramCommand | null {
  const [raw = "", ...arguments_] = text.trim().split(/\s+/);
  if (!raw.startsWith("/")) return null;
  const name = raw.slice(1).split("@")[0].toLowerCase();
  if (name !== "create" && name !== "vote" && name !== "cancle" && name !== "list" && name !== "help" && name !== "start") return null;
  return { name: name === "start" ? "help" : name, argument: arguments_.join(" ") };
}

export function parseVoteHour(value: string) {
  if (!/^\d{1,2}$/.test(value)) return null;
  const hour = Number(value);
  return hour >= 1 && hour <= 24 ? hour : null;
}

function voterName(vote: RecruitmentVoteView) {
  return vote.username ? `${vote.displayName} (@${vote.username})` : vote.displayName;
}

export function formatRecruitment(recruitment: RecruitmentView) {
  const names = recruitment.votes.map((vote) => `- ${voterName(vote)}`).join("\n");
  return [
    `📢 ${recruitment.scheduledDate} ${recruitment.hour}시 치증 모집`,
    `${recruitment.status === "full" ? "✅ 모집 완료" : "모집 중"} · ${recruitment.votes.length}/${recruitment.targetCount}명`,
    "",
    names || "아직 참여자가 없습니다.",
    "",
    `참여: /vote ${recruitment.hour}`,
    `참여취소: /cancle ${recruitment.hour}`,
    "현재 목록: /list",
  ].join("\n");
}

export function helpMessage() {
  return ["치증봇 명령어", "/create 9 - 오늘 9시 모집 생성 (그룹 관리자)", "/vote 9 - 오늘 9시 모집 참여", "/cancle 9 - 오늘 9시 참여 취소", "/list - 현재 모집과 참여자 조회"].join("\n");
}

export function todayInKorea(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(date);
}
