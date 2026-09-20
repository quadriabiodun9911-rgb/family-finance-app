-- General ledger needs no new schema (it's computed from existing
-- transactions/accounts), but income allocation ("three jars") needs:
-- 1) a way to tag which jar a category's spending belongs to, and
-- 2) a place to store the household's target split.
alter table categories add column if not exists jar text
  check (jar in ('expenses', 'savings', 'emergency'));

-- Backfill the one default category that clearly belongs in Savings for
-- households created before this migration.
update categories set jar = 'savings' where name = 'Savings Transfer' and jar is null;

alter table households add column if not exists alloc_expenses_pct numeric not null default 50;
alter table households add column if not exists alloc_savings_pct numeric not null default 30;
alter table households add column if not exists alloc_emergency_pct numeric not null default 20;
