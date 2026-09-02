create or replace function public.claim_telegram_update(p_update_id bigint)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_update_id is null or p_update_id <= 0 then
    raise exception 'invalid Telegram update id';
  end if;

  insert into public.telegram_updates (update_id)
  values (p_update_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 and mod(p_update_id, 100) = 0 then
    delete from public.telegram_updates where processed_at < now() - interval '7 days';
  end if;
  return inserted_count = 1;
end;
$$;

revoke all on function public.claim_telegram_update(bigint) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint) to service_role;

create or replace function public.save_telegram_recruitment_vote(
  p_recruitment_id bigint,
  p_chat_id bigint,
  p_scheduled_date date,
  p_telegram_user_id bigint,
  p_display_name text,
  p_username text,
  p_cancel boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  became_full boolean := false;
  existing_vote boolean;
  next_status text;
  recruitment record;
  vote_count integer;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 or btrim(coalesce(p_display_name, '')) = '' or length(p_display_name) > 100 then
    raise exception 'invalid Telegram voter';
  end if;

  select target_count, status, match_id
  into recruitment
  from public.telegram_recruitments
  where id = p_recruitment_id and chat_id = p_chat_id and scheduled_date = p_scheduled_date
  for update;

  if not found or recruitment.status not in ('open', 'full') then
    return jsonb_build_object('status', 'not_found');
  end if;
  if recruitment.match_id is not null then
    return jsonb_build_object('status', 'locked');
  end if;

  select exists (
    select 1 from public.telegram_recruitment_votes
    where recruitment_id = p_recruitment_id and telegram_user_id = p_telegram_user_id
  ) into existing_vote;

  if p_cancel then
    delete from public.telegram_recruitment_votes
    where recruitment_id = p_recruitment_id and telegram_user_id = p_telegram_user_id;
  elsif existing_vote then
    update public.telegram_recruitment_votes
    set display_name = p_display_name,
        username = nullif(btrim(p_username), ''),
        updated_at = now()
    where recruitment_id = p_recruitment_id and telegram_user_id = p_telegram_user_id;
  else
    select count(*) into vote_count
    from public.telegram_recruitment_votes
    where recruitment_id = p_recruitment_id;
    if vote_count >= recruitment.target_count then
      return jsonb_build_object('status', 'full');
    end if;

    insert into public.telegram_recruitment_votes (recruitment_id, telegram_user_id, display_name, username)
    values (p_recruitment_id, p_telegram_user_id, p_display_name, nullif(btrim(p_username), ''));
  end if;

  select count(*) into vote_count
  from public.telegram_recruitment_votes
  where recruitment_id = p_recruitment_id;
  next_status := case when vote_count >= recruitment.target_count then 'full' else 'open' end;
  became_full := recruitment.status <> 'full' and next_status = 'full';
  update public.telegram_recruitments set status = next_status where id = p_recruitment_id;

  return jsonb_build_object('status', 'saved', 'recruitmentStatus', next_status, 'becameFull', became_full);
end;
$$;

revoke all on function public.save_telegram_recruitment_vote(bigint, bigint, date, bigint, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_telegram_recruitment_vote(bigint, bigint, date, bigint, text, text, boolean) to service_role;
