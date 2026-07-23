alter table public.players
  drop constraint if exists players_tier_check;

alter table public.players
  add constraint players_tier_check check (tier between 1 and 5);
