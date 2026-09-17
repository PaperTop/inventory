begin;
alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('durable','consumable','container'));
alter table public.items add column parent_container_id uuid;
alter table public.items add constraint items_parent_container_fk foreign key (user_id,parent_container_id) references public.items(user_id,id) on delete restrict;
alter table public.items add constraint items_container_quantity check (kind <> 'container' or (quantity=1 and reorder_threshold is null));
alter table public.items add constraint items_placement check (parent_container_id is null or location_id is null);
alter table public.items add constraint items_container_location check (kind <> 'container' or parent_container_id is not null or location_id is not null);
create index items_owner_parent on public.items(user_id,parent_container_id);

create function public.validate_container() returns trigger language plpgsql set search_path='' as $$
declare parent_kind text; cyclic boolean;
begin
 -- Serialize structural changes per owner. Queries after acquiring this lock
 -- see committed parents under READ COMMITTED; concurrent cycles abort safely.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if new.parent_container_id is not null then
  if new.parent_container_id=new.id then raise exception 'Container cycle: cannot contain itself' using errcode='23514'; end if;
  select kind into parent_kind from public.items where user_id=new.user_id and id=new.parent_container_id;
  if parent_kind is distinct from 'container' then raise exception 'The selected container is unavailable' using errcode='23514'; end if;
  with recursive parents as (
   select id,parent_container_id from public.items where user_id=new.user_id and id=new.parent_container_id
   union
   select i.id,i.parent_container_id from public.items i join parents p on i.id=p.parent_container_id where i.user_id=new.user_id
  ) select exists(select 1 from parents where id=new.id) into cyclic;
  if cyclic then raise exception 'Container cycle: cannot move into a descendant' using errcode='23514'; end if;
 end if;
 if new.kind<>'container' and exists(select 1 from public.items where user_id=new.user_id and parent_container_id=new.id) then
  raise exception 'Move contents before changing the container type' using errcode='23514';
 end if;
 return new;
end;$$;
create trigger container_integrity before insert or update on public.items for each row execute function public.validate_container();
revoke all on function public.validate_container() from public,anon,authenticated;

-- A single snapshot contains the whole tree, including ancestors and children
-- beyond the search result cap. Invoker rights retain all existing RLS policies.
create function public.inventory_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 with recursive tree as (
  select i.id, i.user_id, i.location_id as resolved_location_id, l.name as location_name,
   array_remove(array[l.name,i.name],null) as location_path, array[]::uuid[] as ancestor_ids
  from public.items i left join public.locations l on l.id=i.location_id and l.user_id=i.user_id
  where i.user_id=(select auth.uid()) and i.parent_container_id is null
  union all
  select c.id,c.user_id,p.resolved_location_id,p.location_name,p.location_path||c.name,p.ancestor_ids||p.id
  from public.items c join tree p on c.parent_container_id=p.id and c.user_id=p.user_id
 )
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('resolved_location_id',t.resolved_location_id,'location_name',t.location_name,'location_path',t.location_path,'ancestor_ids',t.ancestor_ids) order by i.updated_at desc,i.id),'[]'::jsonb)
 from tree t join public.items i on i.id=t.id and i.user_id=t.user_id;
$$;
revoke all on function public.inventory_snapshot() from public,anon;
grant execute on function public.inventory_snapshot() to authenticated;

create or replace function public.search_inventory(search_query text default '',result_limit integer default 200)
returns setof jsonb language sql stable security invoker set search_path='' as $$
 with terms as (select t from regexp_split_to_table(lower(left(search_query,200)), '[^[:alnum:]]+') t where t<>''),
 ranked as (
  select row, (select count(*) from terms where lower(concat_ws(' ',row->>'name',row->>'description',row->>'category',row->>'location_path',row->>'tags',row->>'attributes')) like '%'||t||'%') as score
  from jsonb_array_elements(public.inventory_snapshot()) row
 ) select row from ranked where not exists(select 1 from terms) or score>0
 order by score desc,row->>'updated_at' desc,row->>'id' limit greatest(1,least(result_limit,200));
$$;
commit;
