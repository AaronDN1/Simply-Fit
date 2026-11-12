-- Simply Fit schema. Every table is owned by a single user and protected by RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  intake jsonb,
  plan jsonb,
  split jsonb,
  settings jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  quantity text not null default '',
  calories integer not null check (calories >= 0),
  protein_g double precision not null default 0,
  carbs_g double precision not null default 0,
  fat_g double precision not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date on public.food_entries (user_id, date);

create table if not exists public.cardio_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  activity text not null,
  minutes integer not null check (minutes > 0),
  intensity text not null default 'moderate',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists cardio_entries_user_date on public.cardio_entries (user_id, date);

create table if not exists public.daily_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  steps integer,
  steps_source text,
  sleep_hours double precision,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  weight_kg double precision,
  readiness jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.workout_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  day_id text not null,
  day_name text not null,
  sets jsonb not null default '[]'::jsonb,
  notes text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists workout_logs_user_date on public.workout_logs (user_id, date);

-- Row level security
alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.cardio_entries enable row level security;
alter table public.daily_logs enable row level security;
alter table public.workout_logs enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own food" on public.food_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cardio" on public.cardio_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily" on public.daily_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts" on public.workout_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a profile row on sign-up (email or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
