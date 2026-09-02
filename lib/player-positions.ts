export const playerPositions = ["올라운더", "탱커", "브루저", "암살자", "메이지", "원딜", "서포터"] as const;

export type PlayerPosition = (typeof playerPositions)[number];

const telegramPositionCodes: Record<string, PlayerPosition> = {
  a: "올라운더",
  t: "탱커",
  b: "브루저",
  s: "암살자",
  m: "메이지",
  c: "원딜",
  p: "서포터",
};

export function telegramPositionCode(position: PlayerPosition) {
  return Object.entries(telegramPositionCodes).find(([, value]) => value === position)?.[0] ?? null;
}

export function telegramPositionFromCode(code: string) {
  return telegramPositionCodes[code] ?? null;
}

export function telegramPositionOptions() {
  return playerPositions.map((position) => ({ position, code: telegramPositionCode(position)! }));
}

export function normalizePlayerPositions(values: string[]): PlayerPosition[] | null {
  if (values.length > 2 || new Set(values).size !== values.length || values.some((position) => !playerPositions.includes(position as PlayerPosition))) return null;
  if (values.includes("올라운더") && (values[0] !== "올라운더" || values.length !== 1)) return null;
  return values as PlayerPosition[];
}
