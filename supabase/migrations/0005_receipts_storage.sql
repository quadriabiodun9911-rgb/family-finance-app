-- Receipt photo attachments: a private storage bucket, scoped by the same
-- household-membership rule as everything else. Objects are stored under
-- `<household_id>/<filename>` so the policy can check membership directly
-- from the path, the same pattern already used for every other table.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "household members manage their receipts"
on storage.objects for all
using (
  bucket_id = 'receipts'
  and public.is_household_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'receipts'
  and public.is_household_member((storage.foldername(name))[1]::uuid)
);

alter table transactions add column if not exists receipt_url text;
