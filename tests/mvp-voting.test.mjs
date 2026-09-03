import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTelegramMvpContests, currentMvpRound, missingMvpVoters, topMvpCandidateIds } from "../lib/mvp-voting.ts";

test("opens a runoff after five votes and keeps only tied leaders", () => {
  const votes = [1, 1, 2, 2, 3].map((candidatePlayerId) => ({ round: 1, candidatePlayerId }));
  assert.equal(currentMvpRound(votes), 2);
  assert.deepEqual([...topMvpCandidateIds(votes)], [1, 2]);
  assert.deepEqual([...topMvpCandidateIds([1, 2, 3, 4, 5].map((candidatePlayerId) => ({ candidatePlayerId })))], [1, 2, 3, 4, 5]);
});

test("builds shared Telegram MVP contests for runoff and finalized teams", () => {
  const members = [1, 2, 3, 4, 5].map((playerId) => ({ playerId, team: "A", nickname: `A${playerId}` })).concat([6, 7, 8, 9, 10].map((playerId) => ({ playerId, team: "B", nickname: `B${playerId}` })));
  const votes = [1, 1, 2, 2, 3].map((candidatePlayerId) => ({ candidateTeam: "A", round: 1, candidatePlayerId }));
  const contests = buildTelegramMvpContests(members, votes, [{ team: "B", playerId: 6, nickname: "B6" }]);
  assert.deepEqual(contests[0], { candidateTeam: "A", round: 2, votesCast: 0, candidates: [{ id: 1, nickname: "A1" }, { id: 2, nickname: "A2" }], winner: null });
  assert.deepEqual(contests[1], { candidateTeam: "B", round: 1, votesCast: 5, candidates: [], winner: { id: 6, nickname: "B6" } });
});

test("lists only opposing participants who have not voted in the current round", () => {
  const members = [1, 2].map((playerId) => ({ playerId, team: "A", nickname: `A${playerId}` })).concat([3, 4, 5].map((playerId) => ({ playerId, team: "B", nickname: `B${playerId}` })));
  assert.deepEqual(missingMvpVoters(members, "A", [3, 5]), [{ id: 4, nickname: "B4" }]);
  assert.deepEqual(missingMvpVoters(members, "B", []), [{ id: 1, nickname: "A1" }, { id: 2, nickname: "A2" }]);
});

test("enforces opponent-only voting and awards one RP once", async () => {
  const [migration, adminMigration, promotionMigration, telegramMigration, telegramMvp, resultRoute, voteRoute, adminRoute, membersPage, roles, webhook] = await Promise.all([
    readFile(new URL("../supabase/migrations/202608270026_add_opponent_mvp_voting.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608300031_admin_finalize_mvp.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608310032_lower_promotion_threshold.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608290030_track_telegram_mvp_message.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/telegram-mvp.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/results/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mvp-votes/[matchId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/mvp/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/members/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/roles.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /primary key \(match_id, candidate_team, round, voter_player_id\)/);
  assert.match(migration, /target_team is null or target_team = voter_team/);
  assert.match(migration, /current_vote_count = 5/);
  assert.match(migration, /top_candidate_count = 1/);
  assert.match(migration, /primary key \(match_id, team\)/);
  assert.match(migration, /revoke all on table public\.match_mvp_votes from public, anon, authenticated/);
  assert.match(migration, /rank_points = rank_points \+ 1/);
  assert.match(promotionMigration, /rank_points = rank_points - 15/g);
  assert.doesNotMatch(promotionMigration, /rank_points > 25|rank_points - 25/);
  assert.match(migration, /mvp_voting_started_at = case when current_status = 'scheduled'/);
  assert.match(migration, /mvp = case when p_mvp_player_id is null then mvp else mvp_name end/);
  assert.match(adminMigration, /actor_role is distinct from 'super_admin'/);
  assert.match(adminMigration, /insert into public\.match_mvp_awards/);
  assert.match(adminMigration, /rank_points = rank_points \+ 1/);
  assert.match(adminMigration, /MVP voting is already finalized/);
  assert.match(adminMigration, /matches\.mvp\.manual_finalize/);
  assert.match(adminMigration, /target_team public\.match_team/);
  assert.match(adminMigration, /vote\.candidate_team = target_team/);
  assert.doesNotMatch(adminMigration, /candidate_team public\.match_team/);
  assert.match(telegramMigration, /add column mvp_message_id bigint/);
  assert.match(telegramMvp, /cast_match_mvp_vote/);
  assert.match(telegramMvp, /mvp_message_id/);
  assert.match(telegramMvp, /save_match_result/);
  assert.match(telegramMvp, /saveTelegramMatchResult/);
  assert.match(resultRoute, /syncTelegramMvpMessage/);
  assert.match(voteRoute, /syncTelegramMvpMessage/);
  assert.match(adminRoute, /user\.role !== "super_admin"/);
  assert.match(adminRoute, /finalizeMatchMvp/);
  assert.match(adminRoute, /syncTelegramMvpMessage/);
  assert.match(membersPage, /canManageRoles && <PendingMvpPanel/);
  assert.match(membersPage, /MVP 확정 · RP \+1/);
  assert.match(membersPage, /현재 투표 내용/);
  assert.match(membersPage, /미투표/);
  assert.match(membersPage, /voterNickname.*candidateNickname/);
  assert.match(roles, /missingMvpVoters/);
  assert.match(roles, /getPendingMvpMatches/);
  assert.match(roles, /voter_player_id,candidate_player_id/);
  assert.match(roles, /admin_finalize_match_mvp/);
  assert.match(webhook, /\^mvp:\(\\d\+\):\(\\d\+\)\$/);
});
