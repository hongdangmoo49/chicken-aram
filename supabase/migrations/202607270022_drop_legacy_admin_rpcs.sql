drop function if exists public.set_player_tiers(jsonb);
drop function if exists public.set_member_roles(jsonb);
drop function if exists public.save_match_result(bigint, timestamptz, smallint, smallint, public.match_team, bigint);
