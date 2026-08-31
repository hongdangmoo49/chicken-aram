export type PlayerTierChange = { playerId: number; tier: number; order: number; points?: number };
export const coachTier = 6;
export const playerTiers = [1, 2, 3, 4, 5, coachTier] as const;
export const promotionPoints = 15;
export const demotionPoints = -15;

export function playerTierLabel(tier: number) {
  return tier === coachTier ? "코치" : `T${tier}`;
}

export function adjustRankPointsForTierChange(points: number, fromTier: number, toTier: number) {
  if (fromTier < 1 || fromTier > 5 || toTier < 1 || toTier > 5) return points;
  if (toTier < fromTier) return points - (fromTier - toTier) * promotionPoints;
  return points + (toTier - fromTier) * Math.abs(demotionPoints);
}

export function needsSuperAdminRankReview(tier: number, points: number) {
  return tier >= 1 && tier <= 5 && ((tier > 1 && points > promotionPoints) || (tier < 5 && points <= demotionPoints));
}

export function normalizeTierChanges(value: unknown): PlayerTierChange[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const changes = new Map<number, PlayerTierChange>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const playerId = Number(record.playerId);
    const tier = Number(record.tier);
    const order = Number(record.order);
    const points = record.points === undefined ? undefined : Number(record.points);
    if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(tier) || tier < 1 || tier > coachTier || !Number.isInteger(order) || order < 0 || order > 99 || (points !== undefined && (!Number.isInteger(points) || Math.abs(points) > 1_000_000))) return null;
    changes.set(playerId, { playerId, tier, order, ...(points === undefined ? {} : { points }) });
  }
  return [...changes.values()];
}
