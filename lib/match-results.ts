export type MatchWinner = "A" | "B";

export type MatchResultInput = {
  playedAt: string;
  aScore: number;
  bScore: number;
  winner: MatchWinner;
  mvpPlayerId: number;
};

export function normalizeMatchResult(value: unknown): MatchResultInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const localDateTime = String(input.playedAt ?? "").trim();
  const aScoreText = String(input.aScore ?? "").trim();
  const bScoreText = String(input.bScore ?? "").trim();
  const winner = String(input.winner ?? "");
  const mvpPlayerId = Number(input.mvpPlayerId);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime) || !/^\d{1,2}$/.test(aScoreText) || !/^\d{1,2}$/.test(bScoreText)) return null;

  const playedAt = new Date(`${localDateTime}+09:00`);
  const aScore = Number(aScoreText);
  const bScore = Number(bScoreText);
  const normalizedDateTime = Number.isNaN(playedAt.getTime()) ? "" : new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(playedAt).replace(" ", "T");
  if (normalizedDateTime !== localDateTime || aScore === bScore || (winner !== "A" && winner !== "B") || (winner === "A") !== (aScore > bScore) || !Number.isInteger(mvpPlayerId) || mvpPlayerId < 1) return null;
  return { playedAt: playedAt.toISOString(), aScore, bScore, winner, mvpPlayerId };
}
