-- household_members' SELECT policy relied solely on is_household_member(),
-- a SECURITY DEFINER function that subquery-checks the same table being
-- inserted into. That self-reference doesn't reliably see the row being
-- returned by the very INSERT that created it (RETURNING is subject to the
-- SELECT policy in Postgres), which is why create_household/join_household
-- failed on "RETURNING * INTO" even though the insert's own WITH CHECK was
-- satisfied. households' policy already had a direct `owner_id = auth.uid()`
-- fallback and never hit this. Adding the equivalent direct fallback here:
-- a user can always see their own membership row, no subquery required.

drop policy "select fellow members" on household_members;
create policy "select fellow members" on household_members for select
  using (is_household_member(household_id) or user_id = auth.uid());

-- Restore the clean (non-debug) create_household now that the real fix is in.
create or replace function create_household(household_name text, currency_code text, currency_symbol text, owner_name text)
returns household_members
language plpgsql
security invoker
as $$
declare
  new_household_id uuid;
  new_member household_members;
begin
  insert into households (name, currency_code, currency_symbol, owner_id)
  values (household_name, currency_code, currency_symbol, auth.uid())
  returning id into new_household_id;

  insert into household_members (household_id, user_id, name, role, permission, color)
  values (new_household_id, auth.uid(), owner_name, 'owner', 'full', '#3b82f6')
  returning * into new_member;

  return new_member;
end;
$$;
