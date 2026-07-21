export function normalizeTeamPlayers(teamAValues: unknown[], teamBValues: unknown[]) {
  const parse = (values: unknown[]) => values.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const teamAIds = parse(teamAValues);
  const teamBIds = parse(teamBValues);
  if (teamAIds.length !== 5 || teamBIds.length !== 5 || new Set([...teamAIds, ...teamBIds]).size !== 10) return null;
  return { teamAIds, teamBIds };
}
