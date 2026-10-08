-- Fix C: enforce the approval workflow in the database (security audit follow-up, 8 Oct 2026)
--
-- Problem (VERIFIED in a rolled-back test): any school member, including a contributor, could
-- call the API directly and set entries.status = 'in_place', change the submission fields,
-- delete entries, and insert forged point_approval_log rows. The app only enforced approval in
-- the UI; the database trusted any member of the school.
--
-- Design:
--  * The approval RPCs (submit / send back / confirm) become the only way a non-approver's
--    approval fields change. submit_entry_for_approval and send_back_entry_approval become
--    SECURITY DEFINER with explicit identity, school and role checks (confirm already was).
--  * A trigger on entries makes direct API writes by non-approvers unable to (a) set status to
--    'in_place', or (b) change submitted_for_approval_at / submitted_by / send_back_note. It is
--    deliberately QUIET (keeps the old value instead of raising), because the evidence modal
--    upserts the whole cached entry back on every save, so a stale cached copy would otherwise
--    break legitimate saves. Approvers and mat_admins keep their direct writes (by design they
--    have no approval step), and the definer RPCs, service role and SQL editor are unaffected.
--  * point_approval_log can only be written by the RPCs; entries can't be deleted by clients.
--
-- Not covered here (tracked in TASKS.md): contributors lowering an approved point's status;
-- contributors editing/deleting evidence on an approved point (Fix D).

-- 1. RPCs: SECURITY DEFINER with explicit checks. Bodies otherwise as before; auth.uid() IS NULL
--    is now rejected explicitly (the old `<>` comparison did not raise for a NULL uid).
create or replace function public.submit_entry_for_approval(p_entry_id uuid, p_submitting_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_caller_school uuid;
begin
  if auth.uid() is null or p_submitting_user_id <> auth.uid() then
    raise exception 'submitting_user_id must match the calling user';
  end if;

  select school_id into v_caller_school from profiles where id = auth.uid();
  select school_id into v_school_id from entries where id = p_entry_id;
  if v_school_id is null or v_caller_school is null or v_school_id <> v_caller_school then
    raise exception 'Entry not found or not permitted';
  end if;

  update entries
  set submitted_for_approval_at = now(), submitted_by = p_submitting_user_id
  where id = p_entry_id;

  insert into point_approval_log (entry_id, school_id, action, actioned_by)
  values (p_entry_id, v_school_id, 'submitted', p_submitting_user_id);
end;
$$;

create or replace function public.send_back_entry_approval(p_entry_id uuid, p_approver_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_school uuid;
  v_entry_school uuid;
begin
  if auth.uid() is null or p_approver_id <> auth.uid() then
    raise exception 'approver_id must match the calling user';
  end if;

  select role, school_id into v_caller_role, v_caller_school from profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('approver', 'mat_admin') then
    raise exception 'Not permitted: approver or mat_admin role required';
  end if;

  update entries
  set status = 'in_progress', submitted_for_approval_at = null, send_back_note = p_note
  where id = p_entry_id and school_id = v_caller_school
  returning school_id into v_entry_school;

  if v_entry_school is null then
    raise exception 'Entry not found or not permitted';
  end if;

  insert into point_approval_log (entry_id, school_id, action, actioned_by, note)
  values (p_entry_id, v_entry_school, 'sent_back', p_approver_id, p_note);
end;
$$;

-- CREATE OR REPLACE keeps existing privileges; restate them so this file is self-describing.
revoke execute on function public.submit_entry_for_approval(uuid, uuid)      from public, anon;
revoke execute on function public.send_back_entry_approval(uuid, uuid, text) from public, anon;
grant  execute on function public.submit_entry_for_approval(uuid, uuid)      to authenticated, service_role;
grant  execute on function public.send_back_entry_approval(uuid, uuid, text) to authenticated, service_role;

-- 2. Guard trigger on entries.
create or replace function public.entries_protect_approval_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text;
begin
  -- Only constrain the API roles. SECURITY DEFINER RPCs run as the function owner, the service
  -- role and the SQL editor are not anon/authenticated, so they pass straight through.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role in ('approver', 'mat_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- An upsert whose row already exists arrives here first; leave it alone, because EXCLUDED
    -- reflects what this trigger returns and altering it would overwrite the existing row.
    -- The UPDATE half of the upsert then applies the rules below.
    if exists (
      select 1 from entries
      where school_id = new.school_id and provision_point_id = new.provision_point_id
    ) then
      return new;
    end if;
    if new.status = 'in_place' then new.status := null; end if;
    new.submitted_for_approval_at := null;
    new.submitted_by := null;
    new.send_back_note := null;
  else
    if new.status = 'in_place' and old.status is distinct from 'in_place' then
      new.status := old.status;
    end if;
    new.submitted_for_approval_at := old.submitted_for_approval_at;
    new.submitted_by              := old.submitted_by;
    new.send_back_note            := old.send_back_note;
  end if;

  return new;
end;
$$;

revoke execute on function public.entries_protect_approval_columns() from public, anon, authenticated;

drop trigger if exists entries_protect_approval_columns on public.entries;
create trigger entries_protect_approval_columns
  before insert or update on public.entries
  for each row execute function public.entries_protect_approval_columns();

-- 3. Close the forgery and delete holes. The client never inserts into point_approval_log
--    (only the RPCs do) and never deletes entries.
drop policy if exists "school members insert approval log" on public.point_approval_log;
revoke insert, update, delete on public.point_approval_log from authenticated;

drop policy if exists "delete own school entries" on public.entries;
revoke delete on public.entries from authenticated;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed; restores the pre-migration state)
--
-- drop trigger if exists entries_protect_approval_columns on public.entries;
-- drop function if exists public.entries_protect_approval_columns();
-- create policy "delete own school entries" on public.entries for delete to public
--   using (school_id = (select profiles.school_id from profiles where profiles.id = auth.uid()));
-- grant delete on public.entries to authenticated;
-- create policy "school members insert approval log" on public.point_approval_log for insert to public
--   with check (school_id = (select profiles.school_id from profiles where profiles.id = auth.uid()));
-- grant insert, update, delete on public.point_approval_log to authenticated;
-- -- restore INVOKER versions of the two RPCs:
-- alter function public.submit_entry_for_approval(uuid, uuid)      security invoker;
-- alter function public.send_back_entry_approval(uuid, uuid, text) security invoker;
-- (the RPC bodies keep the stricter checks, which are safe under INVOKER too)
-- ---------------------------------------------------------------------------------------
