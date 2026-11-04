-- ============================================================
-- Meal Hisab - Supabase schema (Supabase Dashboard > SQL Editor > Run)
-- ============================================================

-- 1) TABLES ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id text not null,
  full_name text not null,
  flat_number text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','deactivated')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);
create unique index profiles_user_id_key on public.profiles (lower(user_id));

create table public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('Lunch','Dinner')),
  selection text not null check (selection in ('ON','OFF')),
  changed_by_admin boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);
create index meals_date_idx on public.meals (meal_date);

create table public.settings (
  id int primary key default 1 check (id = 1),
  lunch_deadline text not null default '23:59',
  dinner_deadline text not null default '14:00',
  selection_window_days int not null default 30
);
insert into public.settings (id) values (1);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  admin_id text not null,
  target_user_id text,
  action text not null,
  old_value text,
  new_value text,
  ts_label text,
  created_at timestamptz not null default now()
);

-- 2) HELPER FUNCTIONS ----------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'active');
$$;

-- 3) ROW LEVEL SECURITY --------------------------------------
alter table public.profiles   enable row level security;
alter table public.meals      enable row level security;
alter table public.settings   enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: user sees own row, admin sees all. Insert/delete only via Edge Function.
create policy "profiles read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- meals
create policy "meals read" on public.meals
  for select using (user_id = auth.uid() or public.is_admin());
create policy "meals insert" on public.meals
  for insert with check ((user_id = auth.uid() and public.is_active()) or public.is_admin());
create policy "meals update" on public.meals
  for update using ((user_id = auth.uid() and public.is_active()) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_active()) or public.is_admin());

-- settings: any logged-in user reads, only admin edits
create policy "settings read" on public.settings
  for select using (auth.uid() is not null);
create policy "settings admin update" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- audit logs: admin only
create policy "audit read" on public.audit_logs
  for select using (public.is_admin());
create policy "audit insert" on public.audit_logs
  for insert with check (public.is_admin());

-- 4) SERVER-SIDE DEADLINE CHECK (BST) ------------------------
-- The browser lock can be bypassed, so the database enforces deadlines too.
create or replace function public.meals_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  admin_user boolean := public.is_admin();
  today date := (now() at time zone 'Asia/Dhaka')::date;
  deadline timestamptz;
begin
  new.updated_at := now();
  new.changed_by_admin := admin_user;
  if admin_user then return new; end if;

  select * into s from public.settings where id = 1;

  if new.meal_date < today then
    raise exception 'Deadline passed for this meal.';
  end if;
  if new.meal_date > today + s.selection_window_days then
    raise exception 'Date is outside the allowed selection window.';
  end if;

  if new.meal_type = 'Lunch' then
    deadline := ((new.meal_date - 1)::timestamp + s.lunch_deadline::time + interval '59 seconds') at time zone 'Asia/Dhaka';
  else
    deadline := (new.meal_date::timestamp + s.dinner_deadline::time + interval '59 seconds') at time zone 'Asia/Dhaka';
  end if;

  if now() > deadline then
    raise exception 'Deadline passed for this meal.';
  end if;
  return new;
end $$;

create trigger meals_guard_trg
  before insert or update on public.meals
  for each row execute function public.meals_guard();

-- 5) REALTIME ------------------------------------------------
alter publication supabase_realtime add table public.meals, public.profiles, public.settings, public.audit_logs;

-- 5b) GUEST MEALS: also run supabase/guest_meals.sql (separate file)

-- 6) FIRST ADMIN ---------------------------------------------
-- Do this AFTER creating the auth user in Dashboard > Authentication > Users > Add user
--   Email: admin@meal-portal.app   Password: (your strong password)   Auto Confirm User: ON
-- Then run:
--
-- insert into public.profiles (id, user_id, full_name, flat_number, role)
-- select id, 'admin', 'System Administrator', 'Admin HQ', 'admin'
-- from auth.users where email = 'admin@meal-portal.app';
