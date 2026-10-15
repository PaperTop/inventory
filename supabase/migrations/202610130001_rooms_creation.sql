begin;

alter table public.locations
  add column parent_location_id uuid,
  add column version integer not null default 1 check (version > 0),
  add constraint locations_parent_owner_fk foreign key (user_id,parent_location_id)
    references public.locations(user_id,id) on delete restrict;

-- Keep consumed Add keys even after the created entity is deleted, so a late
-- retry cannot resurrect it. Entries disappear only with the owning account.
create table public.inventory_creation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check(entity in ('item','location')),
  request_id uuid not null,
  primary key(user_id,entity,request_id)
);
alter table public.inventory_creation_requests enable row level security;
create policy creation_requests_select on public.inventory_creation_requests for select to authenticated using(user_id=(select auth.uid()));
create policy creation_requests_insert on public.inventory_creation_requests for insert to authenticated with check(user_id=(select auth.uid()));
revoke all on public.inventory_creation_requests from anon,authenticated;
grant select,insert on public.inventory_creation_requests to authenticated;

drop index public.locations_owner_name;
create unique index locations_root_name on public.locations(user_id,lower(trim(name)))
  where parent_location_id is null;
create unique index locations_room_name on public.locations(user_id,parent_location_id,lower(trim(name)))
  where parent_location_id is not null;

create function public.validate_inventory_location() returns trigger language plpgsql set search_path='' as $$
declare parent_parent uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
  if TG_OP='UPDATE' then
    if new.user_id<>old.user_id or new.id<>old.id then
      raise exception 'Location identity is immutable' using errcode='23514';
    end if;
    if old.parent_location_id is null and new.parent_location_id is not null then
      raise exception 'A space cannot become a room' using errcode='23514';
    end if;
    if old.parent_location_id is not null and new.parent_location_id is null then
      raise exception 'A room must remain inside a space' using errcode='23514';
    end if;
    new.version:=old.version+1;
  else new.version:=1;
  end if;
  if new.parent_location_id is not null then
    if new.parent_location_id=new.id then
      raise exception 'A location cannot contain itself' using errcode='23514';
    end if;
    select parent_location_id into parent_parent from public.locations
      where user_id=new.user_id and id=new.parent_location_id;
    if not found or parent_parent is not null then
      raise exception 'A room must belong to an available root space' using errcode='23514';
    end if;
  end if;
  return new;
end;$$;
create trigger location_integrity before insert or update on public.locations
  for each row execute function public.validate_inventory_location();
revoke all on function public.validate_inventory_location() from public,anon,authenticated;

create or replace function public.inventory_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$
 with recursive places as (
   select l.id,l.user_id,array[l.name] as path,array[]::uuid[] as ancestor_ids
   from public.locations l where l.user_id=auth.uid() and l.parent_location_id is null
   union all
   select l.id,l.user_id,p.path||l.name,p.ancestor_ids||p.id
   from public.locations l join places p on l.parent_location_id=p.id and l.user_id=p.user_id
 ), tree as (
   select i.id,i.user_id,i.location_id as resolved_location_id,l.name as location_name,
     coalesce(p.path,array[]::text[])||i.name as location_path,array[]::uuid[] as ancestor_ids,
     coalesce(p.ancestor_ids,array[]::uuid[]) as location_ancestor_ids
   from public.items i left join public.locations l on l.id=i.location_id and l.user_id=i.user_id
   left join places p on p.id=l.id and p.user_id=i.user_id
   where i.user_id=auth.uid() and i.parent_container_id is null
   union all
   select c.id,c.user_id,t.resolved_location_id,t.location_name,t.location_path||c.name,
     t.ancestor_ids||t.id,t.location_ancestor_ids
   from public.items c join tree t on c.parent_container_id=t.id and c.user_id=t.user_id
 )
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object(
   'resolved_location_id',t.resolved_location_id,'location_name',t.location_name,
   'location_path',t.location_path,'ancestor_ids',t.ancestor_ids,
   'location_ancestor_ids',t.location_ancestor_ids) order by i.updated_at desc,i.id),'[]'::jsonb)
 from tree t join public.items i on i.id=t.id and i.user_id=t.user_id;
$$;

create function public.create_inventory_location(location_name text,parent_id uuid default null,request_id uuid default null)
returns setof public.locations language plpgsql security invoker set search_path='' as $$
declare new_id uuid:=coalesce(request_id,gen_random_uuid()); request_inserted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if request_id is not null then
    insert into public.inventory_creation_requests(user_id,entity,request_id) values(auth.uid(),'location',request_id) on conflict do nothing;
    get diagnostics request_inserted=row_count;
    if request_inserted=0 and not exists(select 1 from public.locations where id=new_id and user_id=auth.uid()) then
      raise exception 'Creation request was already used for a deleted record' using errcode='23505';
    end if;
  end if;
  if exists(select 1 from public.locations where id=new_id and user_id=auth.uid()) then
    if not exists(select 1 from public.locations where id=new_id and user_id=auth.uid() and name=trim(location_name) and parent_location_id is not distinct from parent_id) then
      raise exception 'Creation request was already used for different data' using errcode='23505';
    end if;
  else
    insert into public.locations(id,user_id,name,parent_location_id)
    values(new_id,auth.uid(),trim(location_name),parent_id);
  end if;
  return query select * from public.locations where id=new_id and user_id=auth.uid();
end;$$;
revoke all on function public.create_inventory_location(text,uuid,uuid) from public,anon;
grant execute on function public.create_inventory_location(text,uuid,uuid) to authenticated;

drop function public.create_inventory_item(jsonb,text);
create function public.create_inventory_item(item_data jsonb,activity_actor text default 'user',request_id uuid default null)
returns setof public.items language plpgsql security invoker set search_path='' as $$
declare new_id uuid:=coalesce(request_id,gen_random_uuid()); request_inserted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if activity_actor is null or activity_actor not in ('user','jarvis') then
    raise exception 'Invalid activity actor' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if request_id is not null then
    insert into public.inventory_creation_requests(user_id,entity,request_id) values(auth.uid(),'item',request_id) on conflict do nothing;
    get diagnostics request_inserted=row_count;
    if request_inserted=0 and not exists(select 1 from public.items where id=new_id and user_id=auth.uid()) then
      raise exception 'Creation request was already used for a deleted record' using errcode='23505';
    end if;
  end if;
  if exists(select 1 from public.items where id=new_id and user_id=auth.uid()) then
    if not exists(select 1 from public.items i where i.id=new_id and i.user_id=auth.uid() and to_jsonb(i) @> item_data) then
      raise exception 'Creation request was already used for different data' using errcode='23505';
    end if;
  else
    perform set_config('inventory.activity_actor',activity_actor,true);
    insert into public.items(id,user_id,name,kind,description,category,quantity,unit,reorder_threshold,
      location_id,parent_container_id,tags,status,condition,attributes)
    values(new_id,auth.uid(),item_data->>'name',item_data->>'kind',item_data->>'description',
      item_data->>'category',(item_data->>'quantity')::numeric,item_data->>'unit',
      (item_data->>'reorder_threshold')::numeric,(item_data->>'location_id')::uuid,
      (item_data->>'parent_container_id')::uuid,array(select jsonb_array_elements_text(item_data->'tags')),
      item_data->>'status',item_data->>'condition',item_data->'attributes');
  end if;
  return query select * from public.items where id=new_id and user_id=auth.uid();
end;$$;
revoke all on function public.create_inventory_item(jsonb,text,uuid) from public,anon;
grant execute on function public.create_inventory_item(jsonb,text,uuid) to authenticated;

-- Keep room creation and the existing item editor on a consistent lock order.
create or replace function public.update_inventory_item(
  item_id uuid,expected_version integer,item_data jsonb,activity_actor text default 'user'
) returns setof public.items language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if activity_actor is null or activity_actor not in ('user','jarvis') then raise exception 'Invalid activity actor' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  perform set_config('inventory.activity_actor',activity_actor,true);
  return query update public.items set
    name=item_data->>'name',kind=item_data->>'kind',description=item_data->>'description',
    category=item_data->>'category',quantity=(item_data->>'quantity')::numeric,unit=item_data->>'unit',
    reorder_threshold=(item_data->>'reorder_threshold')::numeric,location_id=(item_data->>'location_id')::uuid,
    parent_container_id=(item_data->>'parent_container_id')::uuid,
    tags=array(select jsonb_array_elements_text(item_data->'tags')),
    status=item_data->>'status',condition=item_data->>'condition',attributes=item_data->'attributes'
  where user_id=auth.uid() and id=item_id and version=expected_version returning *;
end;$$;

create or replace function public.delete_inventory_item(item_id uuid,expected_version integer,activity_actor text default 'user')
returns boolean language plpgsql security invoker set search_path='' as $$
declare deleted_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if activity_actor is null or activity_actor not in ('user','jarvis') then raise exception 'Invalid activity actor' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  perform set_config('inventory.activity_actor',activity_actor,true);
  delete from public.items where user_id=auth.uid() and id=item_id and version=expected_version;
  get diagnostics deleted_count=row_count;
  return deleted_count=1;
end;$$;

create function public.rename_inventory_location(location_id uuid,location_name text)
returns setof public.locations language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  return query update public.locations set name=trim(location_name) where id=location_id and user_id=auth.uid() returning *;
end;$$;
revoke all on function public.rename_inventory_location(uuid,text) from public,anon;
grant execute on function public.rename_inventory_location(uuid,text) to authenticated;

create or replace function public.delete_inventory_space(space_id uuid,destination_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if space_id=destination_id then raise exception 'Choose another space' using errcode='23514'; end if;
  perform id from public.locations where user_id=auth.uid() and id in(space_id,destination_id) order by id for update;
  if not exists(select 1 from public.locations where id=space_id and user_id=auth.uid()) then raise exception 'Space unavailable' using errcode='42501'; end if;
  if destination_id is not null and not exists(select 1 from public.locations where id=destination_id and user_id=auth.uid()) then raise exception 'Destination unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.locations where user_id=auth.uid() and parent_location_id=space_id) then raise exception 'Remove rooms before deleting their space' using errcode='23514'; end if;
  if destination_id is null and exists(select 1 from public.items where location_id=space_id and user_id=auth.uid()) then raise exception 'A destination is required for nonempty spaces' using errcode='23514'; end if;
  update public.items set location_id=destination_id where user_id=auth.uid() and location_id=space_id;
  delete from public.locations where user_id=auth.uid() and id=space_id;
end;$$;

commit;
