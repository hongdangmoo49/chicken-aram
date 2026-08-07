alter table public.players
  drop constraint if exists players_tier_check;

update public.players set tier = 6 where tier = 5;

alter table public.players
  add constraint players_tier_check check (tier between 1 and 6);

create or replace function public.reject_coach_match_participant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.players where id = new.player_id and tier = 6) then
    raise exception 'coach cannot participate in matches';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_coach_match_participant on public.match_players;
create trigger reject_coach_match_participant
before insert or update of player_id on public.match_players
for each row execute function public.reject_coach_match_participant();
