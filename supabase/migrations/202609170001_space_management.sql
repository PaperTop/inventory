-- Move root items and containers, then delete their old space atomically.
-- Descendants stay inside their containers and inherit the new location.
create function public.delete_inventory_space(space_id uuid, destination_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if space_id = destination_id then
    raise exception 'Choose another space' using errcode = '23514';
  end if;
  -- Lock in stable order, including the destination, to serialize competing moves.
  perform id from public.locations where user_id = auth.uid()
    and id in (space_id, destination_id) order by id for update;
  if not exists (select 1 from public.locations where id = space_id and user_id = auth.uid()) then
    raise exception 'Space unavailable' using errcode = '42501';
  end if;
  if destination_id is not null and not exists
    (select 1 from public.locations where id = destination_id and user_id = auth.uid()) then
    raise exception 'Destination unavailable' using errcode = '42501';
  end if;
  if destination_id is null and exists
    (select 1 from public.items where location_id = space_id and user_id = auth.uid()) then
    raise exception 'A destination is required for nonempty spaces' using errcode = '23514';
  end if;
  update public.items set location_id = destination_id
    where user_id = auth.uid() and location_id = space_id;
  delete from public.locations where user_id = auth.uid() and id = space_id;
end;
$$;
revoke all on function public.delete_inventory_space(uuid, uuid) from public, anon;
grant execute on function public.delete_inventory_space(uuid, uuid) to authenticated;
