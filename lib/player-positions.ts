export const playerPositions = ["올라운더", "탱커", "브루저", "암살자", "메이지", "원딜", "서포터"] as const;

export type PlayerPosition = (typeof playerPositions)[number];

export function normalizePlayerPositions(values: string[]): PlayerPosition[] | null {
  const positions = [...new Set(values)];
  if (positions.length > 3 || positions.some((position) => !playerPositions.includes(position as PlayerPosition))) return null;
  if (positions.includes("올라운더") && positions.length !== 1) return null;
  return positions as PlayerPosition[];
}
