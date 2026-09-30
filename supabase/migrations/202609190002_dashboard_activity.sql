begin;

create table public.inventory_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid,
  item_version integer not null check (item_version > 0),
  item_name text not null check (char_length(item_name) between 1 and 160),
  kind text not null check (kind in ('created', 'updated', 'moved', 'deleted')),
  actor text not null check (actor in ('user', 'jarvis')),
  occurred_at timestamptz not null default now(),
  room_id uuid,
  room_name text not null check (char_length(room_name) between 1 and 100),
  image_path text check (image_path is null or char_length(image_path) <= 1000),
  detail text check (detail is null or char_length(detail) <= 240)
);

create index inventory_activity_owner_time
  on public.inventory_activity(user_id, occurred_at desc, id);

alter table public.inventory_activity enable row level security;
create policy inventory_activity_select on public.inventory_activity
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.inventory_activity from anon, authenticated;
grant select on public.inventory_activity to authenticated;

create table public.inventory_dashboard_visits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_visited_at timestamptz not null
);

alter table public.inventory_dashboard_visits enable row level security;
create policy inventory_dashboard_visits_select
  on public.inventory_dashboard_visits for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.inventory_dashboard_visits from anon, authenticated;
grant select on public.inventory_dashboard_visits to authenticated;

create function public.capture_inventory_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  activity_item public.items;
  activity_kind text;
  activity_actor text;
  activity_detail text;
  activity_room_id uuid;
  activity_room_name text;
  destination_name text;
  activity_image_path text;
begin
  activity_item := case when TG_OP = 'DELETE' then old else new end;
  activity_actor := case
    when current_setting('inventory.activity_actor', true) = 'jarvis' then 'jarvis'
    else 'user'
  end;

  with recursive placement(location_id, parent_container_id, depth) as (
    select activity_item.location_id, activity_item.parent_container_id, 0
    union all
    select parent.location_id, parent.parent_container_id, placement.depth + 1
      from public.items parent
      join placement on parent.id = placement.parent_container_id
     where parent.user_id = activity_item.user_id and placement.depth < 100
  )
  select room.id, room.name into activity_room_id, activity_room_name
    from placement
    join public.locations room on room.id = placement.location_id
     and room.user_id = activity_item.user_id
   order by placement.depth desc limit 1;

  activity_room_name := coalesce(activity_room_name, 'Unassigned');
  activity_image_path := case
    when jsonb_typeof(activity_item.attributes -> 'image_path') = 'string'
      then left(activity_item.attributes ->> 'image_path', 1000)
    else null
  end;

  if TG_OP = 'INSERT' then
    activity_kind := 'created';
    activity_detail := 'Added';
  elsif TG_OP = 'DELETE' then
    activity_kind := 'deleted';
    activity_detail := 'Deleted';
  elsif old.location_id is distinct from new.location_id
     or old.parent_container_id is distinct from new.parent_container_id then
    activity_kind := 'moved';
    if new.parent_container_id is not null then
      select name into destination_name from public.items
       where user_id = new.user_id and id = new.parent_container_id;
    end if;
    activity_detail := 'Moved to ' || coalesce(destination_name, activity_room_name);
  else
    activity_kind := 'updated';
    activity_detail := case
      when old.tags is distinct from new.tags then 'Updated tags'
      when old.name is distinct from new.name then 'Renamed'
      else 'Updated'
    end;
  end if;

  insert into public.inventory_activity(
    user_id, item_id, item_version, item_name, kind, actor, occurred_at,
    room_id, room_name, image_path, detail
  ) values (
    activity_item.user_id, activity_item.id, activity_item.version,
    activity_item.name, activity_kind, activity_actor,
    case when TG_OP = 'DELETE' then now() else activity_item.updated_at end,
    activity_room_id, activity_room_name, activity_image_path, activity_detail
  );
  return activity_item;
end;
$$;

create trigger inventory_activity_capture
after insert or update or delete on public.items
for each row execute function public.capture_inventory_activity();

create function public.create_inventory_item(
  item_data jsonb,
  activity_actor text default 'user'
) returns setof public.items language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if activity_actor not in ('user', 'jarvis') then
    raise exception 'Invalid activity actor' using errcode = '23514';
  end if;
  perform set_config('inventory.activity_actor', activity_actor, true);
  return query insert into public.items(
    user_id, name, kind, description, category, quantity, unit,
    reorder_threshold, location_id, parent_container_id, tags, status,
    condition, attributes
  ) values (
    auth.uid(), item_data ->> 'name', item_data ->> 'kind',
    item_data ->> 'description', item_data ->> 'category',
    (item_data ->> 'quantity')::numeric, item_data ->> 'unit',
    case when item_data -> 'reorder_threshold' = 'null'::jsonb then null
      else (item_data ->> 'reorder_threshold')::numeric end,
    case when item_data -> 'location_id' = 'null'::jsonb then null
      else (item_data ->> 'location_id')::uuid end,
    case when item_data -> 'parent_container_id' = 'null'::jsonb then null
      else (item_data ->> 'parent_container_id')::uuid end,
    array(select jsonb_array_elements_text(item_data -> 'tags')),
    item_data ->> 'status', item_data ->> 'condition', item_data -> 'attributes'
  ) returning *;
end;
$$;

create function public.update_inventory_item(
  item_id uuid,
  expected_version integer,
  item_data jsonb,
  activity_actor text default 'user'
) returns setof public.items language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if activity_actor not in ('user', 'jarvis') then
    raise exception 'Invalid activity actor' using errcode = '23514';
  end if;
  perform set_config('inventory.activity_actor', activity_actor, true);
  return query update public.items set
    name = item_data ->> 'name', kind = item_data ->> 'kind',
    description = item_data ->> 'description', category = item_data ->> 'category',
    quantity = (item_data ->> 'quantity')::numeric, unit = item_data ->> 'unit',
    reorder_threshold = case
      when item_data -> 'reorder_threshold' = 'null'::jsonb then null
      else (item_data ->> 'reorder_threshold')::numeric end,
    location_id = case when item_data -> 'location_id' = 'null'::jsonb then null
      else (item_data ->> 'location_id')::uuid end,
    parent_container_id = case
      when item_data -> 'parent_container_id' = 'null'::jsonb then null
      else (item_data ->> 'parent_container_id')::uuid end,
    tags = array(select jsonb_array_elements_text(item_data -> 'tags')),
    status = item_data ->> 'status', condition = item_data ->> 'condition',
    attributes = item_data -> 'attributes'
  where user_id = auth.uid() and id = item_id and version = expected_version
  returning *;
end;
$$;

create function public.delete_inventory_item(
  item_id uuid,
  expected_version integer,
  activity_actor text default 'user'
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if activity_actor not in ('user', 'jarvis') then
    raise exception 'Invalid activity actor' using errcode = '23514';
  end if;
  perform set_config('inventory.activity_actor', activity_actor, true);
  delete from public.items
   where user_id = auth.uid() and id = item_id and version = expected_version;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create function public.ack_inventory_dashboard_visit(visited_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if visited_at > now() + interval '5 minutes' then
    raise exception 'Invalid dashboard visit time' using errcode = '23514';
  end if;
  insert into public.inventory_dashboard_visits(user_id, last_visited_at)
  values (auth.uid(), least(visited_at, now()))
  on conflict (user_id) do update set
    last_visited_at = greatest(
      public.inventory_dashboard_visits.last_visited_at,
      excluded.last_visited_at
    );
end;
$$;

revoke all on function public.capture_inventory_activity() from public, anon, authenticated;
revoke all on function public.create_inventory_item(jsonb, text) from public, anon;
revoke all on function public.update_inventory_item(uuid, integer, jsonb, text) from public, anon;
revoke all on function public.delete_inventory_item(uuid, integer, text) from public, anon;
revoke all on function public.ack_inventory_dashboard_visit(timestamptz) from public, anon;
grant execute on function public.create_inventory_item(jsonb, text) to authenticated;
grant execute on function public.update_inventory_item(uuid, integer, jsonb, text) to authenticated;
grant execute on function public.delete_inventory_item(uuid, integer, text) to authenticated;
grant execute on function public.ack_inventory_dashboard_visit(timestamptz) to authenticated;

commit;
