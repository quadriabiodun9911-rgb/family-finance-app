-- Temporary diagnostic version of create_household -- reports the actual
-- auth.uid() value and failure point instead of a bare RLS error, so we can
-- see exactly what's happening. Will be replaced once the real cause is
-- found.

create or replace function create_household(household_name text, currency_code text, currency_symbol text, owner_name text)
returns household_members
language plpgsql
security invoker
as $$
declare
  new_household_id uuid;
  new_member household_members;
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'DEBUG: auth.uid() is NULL inside the function';
  end if;

  insert into households (name, currency_code, currency_symbol, owner_id)
  values (household_name, currency_code, currency_symbol, current_uid)
  returning id into new_household_id;

  insert into household_members (household_id, user_id, name, role, permission, color)
  values (new_household_id, current_uid, owner_name, 'owner', 'full', '#3b82f6')
  returning * into new_member;

  return new_member;
exception
  when others then
    raise exception 'DEBUG: uid=%, household_id=%, sqlstate=%, msg=%', current_uid, new_household_id, sqlstate, sqlerrm;
end;
$$;
