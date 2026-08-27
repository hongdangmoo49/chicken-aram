begin;

do $test$
declare
  user_ids uuid[] := array[
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid,
    '00000000-0000-0000-0000-000000000106'::uuid,
    '00000000-0000-0000-0000-000000000107'::uuid,
    '00000000-0000-0000-0000-000000000108'::uuid,
    '00000000-0000-0000-0000-000000000109'::uuid,
    '00000000-0000-0000-0000-000000000110'::uuid
  ];
  player_ids bigint[] := array[]::bigint[];
  created_player_id bigint;
  names text[] := array['MVPTEST-A1','MVPTEST-A2','MVPTEST-A3','MVPTEST-A4','MVPTEST-A5','MVPTEST-B1','MVPTEST-B2','MVPTEST-B3','MVPTEST-B4','MVPTEST-B5'];
  scheduled_match_id bigint;
  voting_match_id bigint;
  old_match_id bigint;
  actual_count integer;
  actual_points integer;
  actual_round integer;
  actual_tier integer;
  rejected boolean;
  i integer;
begin
  for i in 1..10 loop
    insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    values (user_ids[i], 'mvp-test-' || i || '@example.com', jsonb_build_object('display_name', names[i]), now(), now());
    select player_id into created_player_id from public.profiles where id = user_ids[i];
    if created_player_id is null then raise exception 'test player % was not created', i; end if;
    player_ids := array_append(player_ids, created_player_id);
  end loop;

  insert into public.matches (scheduled_at, map, status, team_a, team_b)
  values (now(), '테스트 맵', 'scheduled', names[1:5], names[6:10])
  returning id into scheduled_match_id;
  for i in 1..10 loop
    insert into public.match_players (match_id, player_id, team)
    values (scheduled_match_id, player_ids[i], case when i <= 5 then 'A'::public.match_team else 'B'::public.match_team end);
  end loop;
  perform public.save_match_result(scheduled_match_id, now(), 1::smallint, 0::smallint, 'A', null, user_ids[1]);
  if not exists (select 1 from public.matches where id = scheduled_match_id and mvp_voting_started_at is not null and mvp_player_id is null) then
    raise exception 'new completed match did not open participant MVP voting';
  end if;

  update public.players set tier = 4, rank_points = 0 where id = any(player_ids);
  update public.players set rank_points = 25 where id = player_ids[6];

  insert into public.matches (scheduled_at, played_at, map, status, team_a, team_b, a_score, b_score, winner, mvp_voting_started_at)
  values (now(), now(), '투표 테스트 맵', 'completed', names[1:5], names[6:10], 2, 1, 'A', now())
  returning id into voting_match_id;
  for i in 1..10 loop
    insert into public.match_players (match_id, player_id, team)
    values (voting_match_id, player_ids[i], case when i <= 5 then 'A'::public.match_team else 'B'::public.match_team end);
  end loop;

  rejected := false;
  begin
    perform public.cast_match_mvp_vote(voting_match_id, player_ids[2], user_ids[1]);
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'same-team MVP vote was accepted'; end if;

  perform public.cast_match_mvp_vote(voting_match_id, player_ids[8], user_ids[1]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[6], user_ids[1]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[6], user_ids[2]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[7], user_ids[3]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[7], user_ids[4]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[8], user_ids[5]);

  select count(*) into actual_count from public.match_mvp_votes where match_id = voting_match_id and candidate_team = 'B' and round = 1;
  if actual_count <> 5 then raise exception 'first-round vote upsert/count failed: %', actual_count; end if;
  if exists (select 1 from public.match_mvp_awards where match_id = voting_match_id and team = 'B') then raise exception 'tied first round awarded MVP'; end if;

  for i in 1..5 loop
    perform public.cast_match_mvp_vote(voting_match_id, player_ids[6], user_ids[i]);
  end loop;
  select source_round into actual_round from public.match_mvp_awards where match_id = voting_match_id and team = 'B' and player_id = player_ids[6];
  if actual_round <> 2 then raise exception 'runoff MVP was not awarded from round 2'; end if;
  select tier, rank_points into actual_tier, actual_points from public.players where id = player_ids[6];
  if actual_tier <> 3 or actual_points <> 1 then raise exception 'MVP RP promotion failed: tier %, RP %', actual_tier, actual_points; end if;

  rejected := false;
  begin
    perform public.cast_match_mvp_vote(voting_match_id, player_ids[7], user_ids[1]);
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'finalized MVP contest accepted another vote'; end if;
  select rank_points into actual_points from public.players where id = player_ids[6];
  if actual_points <> 1 then raise exception 'MVP RP was awarded more than once'; end if;

  perform public.cast_match_mvp_vote(voting_match_id, player_ids[1], user_ids[6]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[1], user_ids[7]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[1], user_ids[8]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[2], user_ids[9]);
  perform public.cast_match_mvp_vote(voting_match_id, player_ids[3], user_ids[10]);
  select rank_points into actual_points from public.players where id = player_ids[1];
  if actual_points <> 1 then raise exception 'second team MVP did not receive exactly 1 RP'; end if;
  select count(*) into actual_count from public.match_mvp_awards where match_id = voting_match_id;
  if actual_count <> 2 then raise exception 'both team MVPs were not finalized: %', actual_count; end if;

  insert into public.matches (scheduled_at, played_at, map, status, team_a, team_b, a_score, b_score, winner)
  values (now(), now(), '과거 경기', 'completed', names[1:5], names[6:10], 1, 0, 'A')
  returning id into old_match_id;
  for i in 1..10 loop
    insert into public.match_players (match_id, player_id, team)
    values (old_match_id, player_ids[i], case when i <= 5 then 'A'::public.match_team else 'B'::public.match_team end);
  end loop;
  rejected := false;
  begin
    perform public.cast_match_mvp_vote(old_match_id, player_ids[6], user_ids[1]);
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'historical match incorrectly accepted MVP voting'; end if;

  raise notice 'MVP voting integration test passed: runoff, two awards, RP promotion, idempotency, no retroactive voting';
end;
$test$;

rollback;
