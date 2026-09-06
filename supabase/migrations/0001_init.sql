-- Family Finance — initial schema, RLS policies, and helper functions.
-- Run this once in Supabase Studio → SQL Editor → New query → paste → Run.

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Households ────────────────────────────────────────────────────────────
create table households (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    currency_code text not null default 'NGN',
    currency_symbol text not null default '₦',
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- ── Household members ────────────────────────────────────────────────────
create table household_members (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    role text not null check (role in ('owner','partner','teen','child')),
    permission text not null check (permission in ('full','shared','own')),
    color text not null default '#3b82f6',
    created_at timestamptz not null default now(),
    unique (household_id, user_id)
);

-- ── Household invites ─────────────────────────────────────────────────────
create table household_invites (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    email text not null,
    role text not null check (role in ('owner','partner','teen','child')),
    permission text not null check (permission in ('full','shared','own')),
    invite_code text not null unique,
    invited_by uuid not null references auth.users(id),
    status text not null default 'pending' check (status in ('pending','accepted')),
    created_at timestamptz not null default now()
);

-- ── Categories ────────────────────────────────────────────────────────────
create table categories (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    type text not null check (type in ('income','expense')),
    icon text not null default 'ellipse',
    color text not null default '#94a3b8',
    monthly_target numeric,
    is_default boolean not null default false
);

-- ── Accounts ──────────────────────────────────────────────────────────────
create table accounts (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    type text not null check (type in ('cash','bank','card','other')),
    balance numeric not null default 0,
    created_at timestamptz not null default now()
);

-- ── Income sources ────────────────────────────────────────────────────────
create table income_sources (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    member_id uuid references household_members(id) on delete set null,
    is_primary boolean not null default false,
    is_recurring boolean not null default true,
    expected_monthly_amount numeric,
    created_at timestamptz not null default now()
);

-- ── Transactions ──────────────────────────────────────────────────────────
create table transactions (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    date date not null,
    type text not null check (type in ('income','expense')),
    amount numeric not null check (amount > 0),
    category_id uuid references categories(id) on delete set null,
    member_id uuid references household_members(id) on delete set null,
    income_source_id uuid references income_sources(id) on delete set null,
    account_id uuid references accounts(id) on delete set null,
    ownership text not null default 'shared' check (ownership in ('shared','individual')),
    description text not null default '',
    is_recurring boolean not null default false,
    recurring_frequency text check (recurring_frequency in ('weekly','biweekly','monthly','yearly')),
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);
create index transactions_household_date_idx on transactions (household_id, date desc);

-- ── Recurring bills ───────────────────────────────────────────────────────
create table recurring_bills (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    amount numeric not null,
    due_day int not null check (due_day between 1 and 31),
    category_id uuid references categories(id) on delete set null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- ── Budgets ───────────────────────────────────────────────────────────────
create table budgets (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    category_id uuid not null references categories(id) on delete cascade,
    period text not null,
    planned numeric not null default 0,
    unique (household_id, category_id, period)
);

-- ── Goals ─────────────────────────────────────────────────────────────────
create table goals (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    type text not null check (type in ('savings','debt','investment','custom')),
    icon text not null default 'flag',
    title text not null,
    target_value numeric not null,
    current_value numeric not null default 0,
    deadline date,
    member_id uuid references household_members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table goal_contributions (
    id uuid primary key default gen_random_uuid(),
    goal_id uuid not null references goals(id) on delete cascade,
    date date not null,
    amount numeric not null,
    note text
);

-- ── Investments ───────────────────────────────────────────────────────────
create table investments (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    type text not null check (type in ('stocks','etf','bonds','mutual_fund','retirement','property','other')),
    cost_basis numeric not null default 0,
    current_value numeric not null default 0,
    member_id uuid references household_members(id) on delete set null,
    purchase_date date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ── Debts ─────────────────────────────────────────────────────────────────
create table debts (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    balance numeric not null default 0,
    apr_pct numeric,
    min_payment numeric,
    linked_goal_id uuid references goals(id) on delete set null,
    created_at timestamptz not null default now()
);

-- ── Other assets ──────────────────────────────────────────────────────────
create table other_assets (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    name text not null,
    type text not null check (type in ('property','vehicle','other')),
    value numeric not null default 0,
    created_at timestamptz not null default now()
);

-- ── Net worth snapshots ───────────────────────────────────────────────────
create table net_worth_snapshots (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    date date not null,
    total_assets numeric not null,
    total_liabilities numeric not null,
    net_worth numeric not null,
    unique (household_id, date)
);

-- ── Helper functions (SECURITY DEFINER to avoid RLS self-recursion) ───────
create or replace function is_household_member(hh_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from household_members
    where household_id = hh_id and user_id = auth.uid()
  );
$$;

create or replace function my_member_id(hh_id uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select id from household_members
  where household_id = hh_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function my_permission(hh_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select permission from household_members
  where household_id = hh_id and user_id = auth.uid()
  limit 1;
$$;

-- ── Enable RLS everywhere ─────────────────────────────────────────────────
alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table income_sources enable row level security;
alter table transactions enable row level security;
alter table recurring_bills enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table goal_contributions enable row level security;
alter table investments enable row level security;
alter table debts enable row level security;
alter table other_assets enable row level security;
alter table net_worth_snapshots enable row level security;

-- ── households ────────────────────────────────────────────────────────────
create policy "select own households" on households for select
  using (is_household_member(id) or owner_id = auth.uid());
create policy "create households as self" on households for insert
  with check (owner_id = auth.uid());
create policy "owner updates household" on households for update
  using (owner_id = auth.uid());

-- ── household_members ────────────────────────────────────────────────────
create policy "select fellow members" on household_members for select
  using (is_household_member(household_id));
create policy "join as self" on household_members for insert
  with check (user_id = auth.uid());
create policy "leave or edit self" on household_members for update
  using (user_id = auth.uid() or my_permission(household_id) = 'full');
create policy "full member removes member" on household_members for delete
  using (user_id = auth.uid() or my_permission(household_id) = 'full');

-- ── household_invites ─────────────────────────────────────────────────────
create policy "lookup invite by code" on household_invites for select
  using (auth.role() = 'authenticated');
create policy "full member creates invite" on household_invites for insert
  with check (is_household_member(household_id) and my_permission(household_id) = 'full');
create policy "mark invite accepted" on household_invites for update
  using (auth.role() = 'authenticated');

-- ── simple household-scoped tables (visible to every member) ─────────────
create policy "members read categories" on categories for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read accounts" on accounts for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read income_sources" on income_sources for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read recurring_bills" on recurring_bills for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read budgets" on budgets for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read investments" on investments for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read debts" on debts for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read other_assets" on other_assets for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy "members read net_worth_snapshots" on net_worth_snapshots for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- ── transactions (permission-scoped: full sees all, shared sees shared+own, own sees own only) ─
create policy "transactions visibility" on transactions for select
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or (my_permission(household_id) = 'shared' and (ownership = 'shared' or member_id = my_member_id(household_id)))
      or (my_permission(household_id) = 'own' and member_id = my_member_id(household_id))
    )
  );
create policy "transactions write" on transactions for insert
  with check (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or (my_permission(household_id) = 'shared' and (ownership = 'shared' or member_id = my_member_id(household_id)))
      or (my_permission(household_id) = 'own' and member_id = my_member_id(household_id))
    )
  );
create policy "transactions modify" on transactions for update
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or (my_permission(household_id) = 'shared' and (ownership = 'shared' or member_id = my_member_id(household_id)))
      or (my_permission(household_id) = 'own' and member_id = my_member_id(household_id))
    )
  );
create policy "transactions remove" on transactions for delete
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or (my_permission(household_id) = 'shared' and (ownership = 'shared' or member_id = my_member_id(household_id)))
      or (my_permission(household_id) = 'own' and member_id = my_member_id(household_id))
    )
  );

-- ── goals (shared household goals visible to all; personal goals scoped to owner) ─
create policy "goals visibility" on goals for select
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or member_id is null
      or member_id = my_member_id(household_id)
    )
  );
create policy "goals write" on goals for insert
  with check (is_household_member(household_id));
create policy "goals modify" on goals for update
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or member_id is null
      or member_id = my_member_id(household_id)
    )
  );
create policy "goals remove" on goals for delete
  using (
    is_household_member(household_id) and (
      my_permission(household_id) = 'full'
      or member_id is null
      or member_id = my_member_id(household_id)
    )
  );

-- ── goal_contributions (inherit visibility from parent goal's household) ──
create policy "goal_contributions visibility" on goal_contributions for all
  using (exists (
    select 1 from goals g where g.id = goal_contributions.goal_id and is_household_member(g.household_id)
  ))
  with check (exists (
    select 1 from goals g where g.id = goal_contributions.goal_id and is_household_member(g.household_id)
  ));

-- ── Done ──────────────────────────────────────────────────────────────────
-- Next: in your app, sign up, create a household, and every table above is
-- ready to read/write through supabase-js using the anon key.
