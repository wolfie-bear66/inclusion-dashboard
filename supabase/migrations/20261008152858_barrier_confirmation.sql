-- Barrier confirmation (founder request, 8 Oct 2026).
--
-- Anyone in a school can ADD a barrier. A contributor's new barrier is saved as 'pending' and
-- an approver confirms or declines it; an approver's (or mat_admin's) own barriers are
-- confirmed straight away. A contributor can edit or delete only their own barrier while it is
-- still pending; once confirmed, edits and deletes are approver-only. The app keeps pending
-- barriers out of the Inclusion Strategy, the report data and the MAT dashboard until confirmed.
--
-- All 16 existing barriers belong to demo schools (none in a real trial school) and become
-- 'confirmed' via the column default.
--
-- Same pattern as the approval flow: a quiet guard trigger forces the right values on direct
-- writes, restrictive policies scope who may edit/delete, and SECURITY DEFINER functions do the
-- confirm / decline (with notifications through public.user_notifications).

-- 1. Columns.
alter table public.barriers
  add column if not exists confirmation_status text not null default 'confirmed'
    check (confirmation_status in ('confirmed', 'pending')),
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;

create index if not exists barriers_school_pending on public.barriers (school_id) where confirmation_status = 'pending';

-- 2. Guard (quiet): for non-approver API callers, a new barrier is always pending and owned by
--    the caller, and an existing barrier's confirmation fields cannot be changed directly.
create or replace function public.barriers_protect_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role in ('approver', 'mat_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.confirmation_status := 'pending';
    new.submitted_by := auth.uid();
  else
    new.confirmation_status := old.confirmation_status;
    new.submitted_by := old.submitted_by;
  end if;
  return new;
end;
$$;

revoke execute on function public.barriers_protect_confirmation() from public, anon, authenticated;

drop trigger if exists barriers_protect_confirmation on public.barriers;
create trigger barriers_protect_confirmation
  before insert or update on public.barriers
  for each row execute function public.barriers_protect_confirmation();

-- 3. Tell the school's approvers when a barrier is waiting. SECURITY DEFINER because the
--    submitter cannot insert notifications for other people.
create or replace function public.notify_pending_barrier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.confirmation_status <> 'pending' then
    return new;
  end if;

  select btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name
  from profiles where id = new.submitted_by;

  insert into user_notifications (user_id, kind, title, body, ref_id)
  select p.id, 'barrier_pending', 'Barrier awaiting confirmation',
         coalesce(nullif(v_name, ''), 'A contributor') || ' added a barrier: "'
           || left(new.description, 80) || case when length(new.description) > 80 then '…' else '' end || '"',
         new.id
  from profiles p
  where p.school_id = new.school_id and p.role in ('approver', 'mat_admin');

  return new;
end;
$$;

revoke execute on function public.notify_pending_barrier() from public, anon, authenticated;

drop trigger if exists barriers_notify_pending on public.barriers;
create trigger barriers_notify_pending
  after insert on public.barriers
  for each row execute function public.notify_pending_barrier();

-- 4. Who may edit or delete (restrictive, ANDed with the existing school-scoping policies):
--    approvers/mat_admins, or the author while the barrier is still pending.
drop policy if exists "barrier_edit_scope_update" on public.barriers;
create policy "barrier_edit_scope_update" on public.barriers as restrictive for update to authenticated
  using (public.get_my_role() in ('approver', 'mat_admin') or (confirmation_status = 'pending' and submitted_by = auth.uid()))
  with check (public.get_my_role() in ('approver', 'mat_admin') or (confirmation_status = 'pending' and submitted_by = auth.uid()));

drop policy if exists "barrier_edit_scope_delete" on public.barriers;
create policy "barrier_edit_scope_delete" on public.barriers as restrictive for delete to authenticated
  using (public.get_my_role() in ('approver', 'mat_admin') or (confirmation_status = 'pending' and submitted_by = auth.uid()));

-- The provision-point links follow their barrier.
do $$
declare t text;
begin
  foreach t in array array['barrier_provision_points', 'barrier_provision_links'] loop
    execute format('drop policy if exists %I on public.%I', 'link_edit_scope_insert', t);
    execute format('drop policy if exists %I on public.%I', 'link_edit_scope_update', t);
    execute format('drop policy if exists %I on public.%I', 'link_edit_scope_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for insert to authenticated
      with check (public.get_my_role() in ('approver', 'mat_admin') or exists (
        select 1 from public.barriers b where b.id = barrier_id and b.confirmation_status = 'pending' and b.submitted_by = auth.uid()))$f$,
      'link_edit_scope_insert', t);
    execute format($f$create policy %I on public.%I as restrictive for update to authenticated
      using (public.get_my_role() in ('approver', 'mat_admin') or exists (
        select 1 from public.barriers b where b.id = barrier_id and b.confirmation_status = 'pending' and b.submitted_by = auth.uid()))
      with check (public.get_my_role() in ('approver', 'mat_admin') or exists (
        select 1 from public.barriers b where b.id = barrier_id and b.confirmation_status = 'pending' and b.submitted_by = auth.uid()))$f$,
      'link_edit_scope_update', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to authenticated
      using (public.get_my_role() in ('approver', 'mat_admin') or exists (
        select 1 from public.barriers b where b.id = barrier_id and b.confirmation_status = 'pending' and b.submitted_by = auth.uid()))$f$,
      'link_edit_scope_delete', t);
  end loop;
end $$;

-- 5. Approver actions.
create or replace function public.confirm_barrier(p_barrier_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_school uuid;
  v_submitter uuid;
  v_desc text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
  end if;

  select role, school_id into v_role, v_caller_school from profiles where id = auth.uid();
  if v_role is null or v_role not in ('approver', 'mat_admin') then
    raise exception 'Not permitted: approver or mat_admin role required';
  end if;

  update barriers
  set confirmation_status = 'confirmed'
  where id = p_barrier_id and school_id = v_caller_school and confirmation_status = 'pending'
  returning submitted_by, description into v_submitter, v_desc;

  if not found then
    raise exception 'Barrier not found or already confirmed';
  end if;

  if v_submitter is not null and v_submitter <> auth.uid() then
    insert into user_notifications (user_id, kind, title, body, ref_id)
    values (v_submitter, 'barrier_confirmed', 'Barrier confirmed',
            'Your barrier "' || left(v_desc, 80) || case when length(v_desc) > 80 then '…' else '' end || '" was confirmed.',
            p_barrier_id);
  end if;
end;
$$;

-- Declining removes the pending barrier (and its links, by cascade). The contributor's
-- notification repeats the start of the description so they know which one it was.
create or replace function public.decline_barrier(p_barrier_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_school uuid;
  v_submitter uuid;
  v_desc text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
  end if;

  select role, school_id into v_role, v_caller_school from profiles where id = auth.uid();
  if v_role is null or v_role not in ('approver', 'mat_admin') then
    raise exception 'Not permitted: approver or mat_admin role required';
  end if;

  delete from barriers
  where id = p_barrier_id and school_id = v_caller_school and confirmation_status = 'pending'
  returning submitted_by, description into v_submitter, v_desc;

  if not found then
    raise exception 'Barrier not found or already dealt with';
  end if;

  if v_submitter is not null and v_submitter <> auth.uid() then
    insert into user_notifications (user_id, kind, title, body, ref_id)
    values (v_submitter, 'barrier_declined', 'Barrier declined',
            'Your barrier "' || left(v_desc, 80) || case when length(v_desc) > 80 then '…' else '' end || '" was not added.'
              || coalesce(' Note: ' || v_note, ''),
            p_barrier_id);
  end if;
end;
$$;

revoke execute on function public.confirm_barrier(uuid)       from public, anon;
revoke execute on function public.decline_barrier(uuid, text) from public, anon;
grant  execute on function public.confirm_barrier(uuid)       to authenticated, service_role;
grant  execute on function public.decline_barrier(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed)
--
-- drop function if exists public.confirm_barrier(uuid);
-- drop function if exists public.decline_barrier(uuid, text);
-- drop trigger if exists barriers_notify_pending on public.barriers;
-- drop function if exists public.notify_pending_barrier();
-- drop trigger if exists barriers_protect_confirmation on public.barriers;
-- drop function if exists public.barriers_protect_confirmation();
-- drop policy if exists "barrier_edit_scope_update" on public.barriers;
-- drop policy if exists "barrier_edit_scope_delete" on public.barriers;
-- do $$ declare t text; begin
--   foreach t in array array['barrier_provision_points','barrier_provision_links'] loop
--     execute format('drop policy if exists link_edit_scope_insert on public.%I', t);
--     execute format('drop policy if exists link_edit_scope_update on public.%I', t);
--     execute format('drop policy if exists link_edit_scope_delete on public.%I', t);
--   end loop; end $$;
-- drop index if exists public.barriers_school_pending;
-- alter table public.barriers drop column if exists submitted_by, drop column if exists confirmation_status;
-- (any pending barriers become ordinary rows if you drop the columns; confirm or delete them first)
-- ---------------------------------------------------------------------------------------
