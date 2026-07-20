export type PlayerTierChange = { playerId: number; tier: number; order: number };

export function normalizeTierChanges(value: unknown): PlayerTierChange[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const changes = new Map<number, number>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const playerId = Number((item as Record<string, unknown>).playerId);
    const tier = Number((item as Record<string, unknown>).tier);
    const order = Number((item as Record<string, unknown>).order);
    if (!Number.isInteger(playerId) || playerId < 1 || !Number.isInteger(tier) || tier < 1 || tier > 4 || !Number.isInteger(order) || order < 0 || order > 99) return null;
    changes.set(playerId, tier * 100 + order);
  }
  return [...changes].map(([playerId, value]) => ({ playerId, tier: Math.floor(value / 100), order: value % 100 }));
}
