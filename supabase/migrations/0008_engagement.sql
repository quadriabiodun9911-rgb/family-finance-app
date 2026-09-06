-- Engagement: daily check-in streaks per member + one-time milestone celebrations.
alter table household_members add column if not exists current_streak int not null default 0;
alter table household_members add column if not exists longest_streak int not null default 0;
alter table household_members add column if not exists last_active_date date;

create table if not exists milestones_seen (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  key text not null,
  achieved_at timestamptz not null default now(),
  unique (household_id, key)
);

alter table milestones_seen enable row level security;

create policy "household members view milestones" on milestones_seen for select
  using (public.is_household_member(household_id));
create policy "household members record milestones" on milestones_seen for insert
  with check (public.is_household_member(household_id));

grant select, insert on milestones_seen to authenticated;
