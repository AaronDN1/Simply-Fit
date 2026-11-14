-- Age gate and durable AI quotas. Apply this in the Supabase project before production signups.

create or replace function public.profile_is_eligible(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and intake is not null
      and (intake ->> 'age') ~ '^[0-9]+(\.[0-9]+)?$'
      and (intake ->> 'age')::numeric >= 16
      and (intake ->> 'age')::numeric <= 90
  );
$$;

revoke all on function public.profile_is_eligible(uuid) from public;
grant execute on function public.profile_is_eligible(uuid) to authenticated;

create or replace function public.reject_ineligible_intake()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.intake is null then
    return new;
  end if;
  if not (
    (new.intake ->> 'age') ~ '^[0-9]+(\.[0-9]+)?$'
    and (new.intake ->> 'age')::numeric >= 16
    and (new.intake ->> 'age')::numeric <= 90
  ) then
    raise exception 'Simply Fit is for ages 16 to 90.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reject_ineligible_intake on public.profiles;
create trigger profiles_reject_ineligible_intake
  before insert or update on public.profiles
  for each row execute function public.reject_ineligible_intake();

-- Inserts and updates of health logs require a stored age of 16–90. Reads of existing rows stay available.
drop policy if exists "own food" on public.food_entries;
create policy "own food" on public.food_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.profile_is_eligible(auth.uid()));

drop policy if exists "own cardio" on public.cardio_entries;
create policy "own cardio" on public.cardio_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.profile_is_eligible(auth.uid()));

drop policy if exists "own daily" on public.daily_logs;
create policy "own daily" on public.daily_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.profile_is_eligible(auth.uid()));

drop policy if exists "own workouts" on public.workout_logs;
create policy "own workouts" on public.workout_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.profile_is_eligible(auth.uid()));

create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  day date not null,
  hits integer not null,
  primary key (user_id, bucket)
);

alter table public.ai_rate_limits enable row level security;
revoke all on table public.ai_rate_limits from anon, authenticated;

-- Returns true when the call is within the daily cap. Service role only.
create or replace function public.consume_ai_quota(p_user uuid, p_bucket text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  current_hits integer;
begin
  insert into public.ai_rate_limits (user_id, bucket, day, hits)
  values (p_user, p_bucket, today, 1)
  on conflict (user_id, bucket) do update
    set
      hits = case when ai_rate_limits.day = today then ai_rate_limits.hits + 1 else 1 end,
      day = today
  returning hits into current_hits;
  return current_hits <= p_limit;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer) from public;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
