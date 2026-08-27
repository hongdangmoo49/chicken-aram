import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { currentMvpRound, topMvpCandidateIds } from "../lib/mvp-voting.ts";

test("opens a runoff after five votes and keeps only tied leaders", () => {
  const votes = [1, 1, 2, 2, 3].map((candidatePlayerId) => ({ round: 1, candidatePlayerId }));
  assert.equal(currentMvpRound(votes), 2);
  assert.deepEqual([...topMvpCandidateIds(votes)], [1, 2]);
  assert.deepEqual([...topMvpCandidateIds([1, 2, 3, 4, 5].map((candidatePlayerId) => ({ candidatePlayerId })))], [1, 2, 3, 4, 5]);
});

test("enforces opponent-only voting and awards one RP once", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202608270026_add_opponent_mvp_voting.sql", import.meta.url), "utf8");
  assert.match(migration, /primary key \(match_id, candidate_team, round, voter_player_id\)/);
  assert.match(migration, /target_team is null or target_team = voter_team/);
  assert.match(migration, /current_vote_count = 5/);
  assert.match(migration, /top_candidate_count = 1/);
  assert.match(migration, /primary key \(match_id, team\)/);
  assert.match(migration, /revoke all on table public\.match_mvp_votes from public, anon, authenticated/);
  assert.match(migration, /rank_points = rank_points \+ 1/);
  assert.match(migration, /rank_points = rank_points - 25/);
  assert.match(migration, /mvp_voting_started_at = case when current_status = 'scheduled'/);
  assert.match(migration, /mvp = case when p_mvp_player_id is null then mvp else mvp_name end/);
});
