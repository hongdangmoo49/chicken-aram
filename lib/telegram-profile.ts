import type { PlayerPosition } from "./player-positions";

export type TelegramProfileView = {
  nickname: string;
  tier: number;
  points: number;
  positions: PlayerPosition[];
  telegramUsername: string | null;
  matchWins: number;
  matchLosses: number;
  roundWins: number;
  roundLosses: number;
};

const rate = (wins: number, losses: number) => wins + losses ? Math.round(wins / (wins + losses) * 100) : 0;

export function formatTelegramProfile(profile: TelegramProfileView) {
  const primary = profile.positions[0] ?? "미등록";
  const secondary = profile.positions[0] === "올라운더" ? "선택 불가" : profile.positions[1] ?? "미등록";
  return [
    "👤 내 치증 프로필",
    "",
    `이름: ${profile.nickname}`,
    `티어: T${profile.tier} · RP ${profile.points}점`,
    `1순위: ${primary}`,
    `2순위: ${secondary}`,
    `Telegram 연동: ✅${profile.telegramUsername ? ` @${profile.telegramUsername}` : ""}`,
    "",
    `경기: ${profile.matchWins}승 ${profile.matchLosses}패 · 승률 ${rate(profile.matchWins, profile.matchLosses)}%`,
    `라운드: ${profile.roundWins}승 ${profile.roundLosses}패 · 승률 ${rate(profile.roundWins, profile.roundLosses)}%`,
    "",
    "승률과 전적은 등록된 경기 결과로 자동 계산됩니다.",
  ].join("\n");
}
