export type PlayerTierChange = { playerId: number; tier: number };

export function normalizeTierChanges(value: unknown): PlayerTierChange[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const changes = new Map<number, number>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const playerId = Number((item as Record<string, unknown>).playerId);
    const tier = Number((item as Record<string, unknown>).tier);
    if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(tier) || tier < 1 || tier > 4) return null;
    changes.set(playerId, tier);
  }
  return [...changes].map(([playerId, tier]) => ({ playerId, tier }));
}
