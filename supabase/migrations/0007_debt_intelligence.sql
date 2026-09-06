-- Richer debt tracking for amortization/payoff-strategy intelligence.
alter table debts add column if not exists type text not null default 'other'
  check (type in ('mortgage','auto','credit_card','student','personal','other'));
alter table debts add column if not exists original_principal numeric;
