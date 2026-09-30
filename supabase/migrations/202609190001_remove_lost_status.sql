begin;

-- Preserve legacy records while removing the user-facing Missing state.
-- The item version trigger records this status change like any other update.
update public.items set status = 'active' where status = 'lost';

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('active', 'stored', 'lent', 'disposed'));

commit;
