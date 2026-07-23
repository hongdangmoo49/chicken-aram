create table public.request_rate_limits (
  key text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (key, window_started_at)
);

create index request_rate_limits_window_idx
  on public.request_rate_limits (window_started_at);

alter table public.request_rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  bucket timestamptz;
  current_count integer;
begin
  if length(p_key) <> 64 or p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit input';
  end if;

  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.request_rate_limits (key, window_started_at, request_count)
  values (p_key, bucket, 1)
  on conflict (key, window_started_at)
  do update set request_count = public.request_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from public.request_rate_limits
  where window_started_at < now() - interval '2 days';

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
