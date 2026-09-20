-- households' UPDATE policy only let the literal creator (owner_id) change
-- household-level settings. Every other per-member table in this schema
-- also allows any 'full'-permission member (see household_members'
-- "leave or edit self" policy) -- households was the odd one out, and the
-- new Income Allocation target is the first feature that updates a
-- household row after creation, so a non-owner "full" partner would have
-- their save silently rejected by RLS.
drop policy if exists "owner updates household" on households;
create policy "owner or full member updates household" on households for update
  using (owner_id = auth.uid() or my_permission(id) = 'full');
