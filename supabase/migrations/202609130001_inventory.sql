begin;
create table public.locations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 100), created_at timestamptz not null default now(),
 unique(user_id,id)
);
create unique index locations_owner_name on public.locations(user_id,lower(trim(name)));
create table public.items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 160),
 kind text not null default 'durable' check(kind in ('durable','consumable')),
 description text not null default '' check(char_length(description)<=2000), category text not null default '' check(char_length(category)<=80),
 quantity numeric not null default 1 check(quantity between 0 and 1000000000),
 unit text not null default 'item' check(char_length(trim(unit)) between 1 and 30),
 reorder_threshold numeric check(reorder_threshold between 0 and 1000000000),
 location_id uuid, tags text[] not null default '{}' check(cardinality(tags)<=20),
 status text not null default 'active' check(status in ('active','stored','lent','lost','disposed')),
 condition text not null default 'unknown' check(condition in ('new','good','fair','poor','unknown')),
 attributes jsonb not null default '{}' check(jsonb_typeof(attributes)='object' and octet_length(attributes::text)<=16000),
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,id), foreign key(user_id,location_id) references public.locations(user_id,id),
 check(kind <> 'durable' or (quantity=1 and reorder_threshold is null))
);
create index items_owner_updated on public.items(user_id,updated_at desc);
create index items_owner_location on public.items(user_id,location_id);
create index items_tags on public.items using gin(tags);
create function public.stamp_inventory_item() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.user_id<>old.user_id or new.id<>old.id then raise exception 'Item identity is immutable'; end if;
  new.version:=old.version+1;new.created_at:=old.created_at;
 else new.version:=1;new.created_at:=now();
 end if;
 new.updated_at:=now();return new;
end;$$;
create trigger item_version before insert or update on public.items for each row execute function public.stamp_inventory_item();
create table public.inventory_observations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null,source text not null check(source in ('camera','receipt','manual')),
 source_event_id text not null check(char_length(source_event_id) between 1 and 200),
 confidence double precision not null check(confidence between 0 and 1),
 observed_at timestamptz not null default now(),received_at timestamptz not null default now(),
 base_version integer not null check(base_version>0),
 proposed_patch jsonb not null default '{}' check(jsonb_typeof(proposed_patch)='object' and octet_length(proposed_patch::text)<=16000),
 unique(user_id,source,source_event_id),foreign key(user_id,item_id) references public.items(user_id,id) on delete cascade
);
create index observations_owner_item on public.inventory_observations(user_id,item_id);
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.inventory_observations enable row level security;
create policy locations_select on public.locations for select to authenticated using(user_id=(select auth.uid()));
create policy locations_insert on public.locations for insert to authenticated with check(user_id=(select auth.uid()));
create policy locations_update on public.locations for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy locations_delete on public.locations for delete to authenticated using(user_id=(select auth.uid()));
create policy items_select on public.items for select to authenticated using(user_id=(select auth.uid()));
create policy items_insert on public.items for insert to authenticated with check(user_id=(select auth.uid()));
create policy items_update on public.items for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy items_delete on public.items for delete to authenticated using(user_id=(select auth.uid()));
create policy observations_select on public.inventory_observations for select to authenticated using(user_id=(select auth.uid()));
create policy observations_insert on public.inventory_observations for insert to authenticated with check(user_id=(select auth.uid()));
revoke all on public.items,public.locations,public.inventory_observations from anon,authenticated;
grant select,insert,update,delete on public.items,public.locations to authenticated;
grant select,insert on public.inventory_observations to authenticated;
-- Invoker rights retain the caller's RLS. No dynamic SQL; punctuation is only data.
create function public.search_inventory(search_query text default '',result_limit integer default 200)
returns setof jsonb language sql stable security invoker set search_path='' as $$
 with terms as (select t from regexp_split_to_table(lower(left(search_query,200)), '[^[:alnum:]]+') t where t<>''),
 ranked as (
  select i, l.name as location_name,
   (select count(*) from terms where lower(concat_ws(' ',i.name,i.description,i.category,l.name,array_to_string(i.tags,' '),i.attributes::text)) like '%'||t||'%') as score
  from public.items i left join public.locations l on l.id=i.location_id and l.user_id=i.user_id
  where i.user_id=(select auth.uid())
 )
 select to_jsonb(i)||jsonb_build_object('location_name',location_name) from ranked
 where not exists(select 1 from terms) or score>0
 order by score desc,(i).updated_at desc,(i).id limit greatest(1,least(result_limit,200));
$$;
revoke all on function public.search_inventory(text,integer) from public,anon;
grant execute on function public.search_inventory(text,integer) to authenticated;
revoke all on function public.stamp_inventory_item() from public,anon,authenticated;
commit;
