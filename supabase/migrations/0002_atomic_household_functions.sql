-- Atomic household create/join -- replaces the two-separate-inserts approach
-- (household row, then household_members row) with one transaction per
-- operation, closing a race window where the second insert could run
-- without the expected auth context.

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

grant execute on function create_household(text, text, text, text) to authenticated;

create or replace function join_household(p_invite_code text, member_name text)
returns household_members
language plpgsql
security invoker
as $$
declare
  invite household_invites;
  new_member household_members;
  member_count int;
  palette text[] := array['#3b82f6','#a855f7','#f97316','#22c55e','#ec4899','#14b8a6'];
begin
  select * into invite from household_invites
    where invite_code = upper(p_invite_code) and status = 'pending'
    limit 1;
  if invite.id is null then
    raise exception 'Invite code not found or already used.';
  end if;

  select count(*) into member_count from household_members where household_id = invite.household_id;

  insert into household_members (household_id, user_id, name, role, permission, color)
  values (invite.household_id, auth.uid(), member_name, invite.role, invite.permission, palette[(member_count % 6) + 1])
  returning * into new_member;

  update household_invites set status = 'accepted' where id = invite.id;

  return new_member;
end;
$$;

grant execute on function join_household(text, text) to authenticated;
