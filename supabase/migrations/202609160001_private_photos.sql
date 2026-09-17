begin;

-- Supabase supplies storage.buckets / storage.objects and enables their RLS.
-- Fresh paths keep replacements from overwriting an image still used elsewhere.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-photos', 'inventory-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy inventory_photos_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'inventory-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
);

create policy inventory_photos_select on storage.objects
for select to authenticated using (
  bucket_id = 'inventory-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

-- Objects are immutable. Deletion is reserved for explicit owner cleanup;
-- item deletion/replacement never risks deleting a duplicate item's photo.
create policy inventory_photos_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'inventory-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

commit;
