create or replace function public.get_match_counts()
returns table(total bigint, completed bigint, scheduled bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*)::bigint,
    count(*) filter (where status = 'completed')::bigint,
    count(*) filter (where status = 'scheduled')::bigint
  from public.matches;
$$;

revoke all on function public.get_match_counts() from public;
grant execute on function public.get_match_counts() to anon, authenticated, service_role;
