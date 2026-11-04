-- ============================================================
-- GUEST MEALS (run once in Supabase > SQL Editor)
-- ============================================================
create table public.guest_meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('Lunch','Dinner')),
  quantity int not null default 1 check (quantity between 0 and 10),  -- 0 = cancelled
  updated_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);
create index guest_meals_date_idx on public.guest_meals (meal_date);

alter table public.guest_meals enable row level security;

-- user sees own rows, admin sees all
create policy "guest read" on public.guest_meals
  for select using (user_id = auth.uid() or public.is_admin());
-- only the user can order / change / cancel their own guest meals
create policy "guest insert" on public.guest_meals
  for insert with check (user_id = auth.uid() and public.is_active());
create policy "guest update" on public.guest_meals
  for update using (user_id = auth.uid() and public.is_active())
  with check (user_id = auth.uid() and public.is_active());

-- same deadline rules as regular meals (BST), enforced on the server
create or replace function public.guest_meals_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings%rowtype;
  today date := (now() at time zone 'Asia/Dhaka')::date;
  deadline timestamptz;
begin
  new.updated_at := now();
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

create trigger guest_meals_guard_trg
  before insert or update on public.guest_meals
  for each row execute function public.guest_meals_guard();

-- realtime updates
alter publication supabase_realtime add table public.guest_meals;
