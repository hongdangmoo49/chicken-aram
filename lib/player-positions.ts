export const playerPositions = ["올라운더", "탱커", "브루저", "암살자", "메이지", "원딜", "서포터"] as const;

export type PlayerPosition = (typeof playerPositions)[number];

export function normalizePlayerPositions(values: string[]): PlayerPosition[] | null {
  if (values.length > 2 || new Set(values).size !== values.length || values.some((position) => !playerPositions.includes(position as PlayerPosition))) return null;
  if (values.includes("올라운더") && (values[0] !== "올라운더" || values.length !== 1)) return null;
  return values as PlayerPosition[];
}
