-- Fix D: role rules for writes, approved-evidence protection, same-school assignments, and a
-- database-level read-only demo account (security audit follow-up, 8 Oct 2026).
--
-- Findings this addresses:
--  * D0 (TRACED): /demo signs in as demo@testschool.co.uk with a password shipped in the public
--    page code. That account is a real mat_admin of the Demo MAT, and the UI-only read-only
--    mode did not stop API writes, nor invite-user / remove-team-member (edge functions, patched
--    separately in the repo) from creating real accounts and sending email from our domain.
--  * D2: barriers, the Inclusion Strategy tables and school_context accepted writes from any
--    school member, including contributors.
--  * D3: contributors could edit or delete evidence on an already-approved (in_place) point.
--  * D1: an approver could assign a point to a user from a different school.
--
-- Decisions (founder, 8 Oct 2026): barriers and strategy/context are approver + mat_admin only;
-- contributors may not change evidence on approved points (the date-only "Confirm still current"
-- review stays open to everyone); the demo account becomes read-only everywhere.
--
-- Implemented as RESTRICTIVE policies (ANDed with the existing permissive ones), so the existing
-- school-scoping policies are untouched and the rollback is a plain DROP POLICY.

-- 0. Helper: the caller's profile role (SECURITY DEFINER so it works inside policies on tables
--    that profiles' own policies might otherwise recurse into).
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() limit 1;
$$;

revoke execute on function public.get_my_role() from public, anon;
grant  execute on function public.get_my_role() to authenticated, service_role;

-- 1. D0: the demo account cannot write anywhere in school data. (Its own profile row is left
--    alone: the app updates welcomed / onboarding_state there.)
do $$
declare t text; c text;
begin
  foreach t in array array[
    'entries', 'evidence_entries', 'barriers', 'barrier_provision_points', 'barrier_provision_links',
    'inclusion_strategy_drafts', 'inclusion_strategy_outcomes', 'inclusion_strategy_priorities',
    'inclusion_strategy_priority_barriers', 'school_context', 'friction_logs', 'point_assignments',
    'my_points_queue_state'
  ] loop
    foreach c in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'no_demo_writes_' || c, t);
      if c = 'insert' then
        execute format($f$create policy %I on public.%I as restrictive for insert to authenticated
                          with check ((auth.jwt() ->> 'email') is distinct from 'demo@testschool.co.uk')$f$, 'no_demo_writes_' || c, t);
      elsif c = 'update' then
        execute format($f$create policy %I on public.%I as restrictive for update to authenticated
                          using ((auth.jwt() ->> 'email') is distinct from 'demo@testschool.co.uk')
                          with check ((auth.jwt() ->> 'email') is distinct from 'demo@testschool.co.uk')$f$, 'no_demo_writes_' || c, t);
      else
        execute format($f$create policy %I on public.%I as restrictive for delete to authenticated
                          using ((auth.jwt() ->> 'email') is distinct from 'demo@testschool.co.uk')$f$, 'no_demo_writes_' || c, t);
      end if;
    end loop;
  end loop;
end $$;

-- 2. D2: barriers, strategy and school context are writable only by approvers and mat_admins.
do $$
declare t text; c text;
begin
  foreach t in array array[
    'barriers', 'barrier_provision_points', 'barrier_provision_links',
    'inclusion_strategy_drafts', 'inclusion_strategy_outcomes', 'inclusion_strategy_priorities',
    'inclusion_strategy_priority_barriers', 'school_context'
  ] loop
    foreach c in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'write_requires_approver_' || c, t);
      if c = 'insert' then
        execute format($f$create policy %I on public.%I as restrictive for insert to authenticated
                          with check (public.get_my_role() in ('approver', 'mat_admin'))$f$, 'write_requires_approver_' || c, t);
      elsif c = 'update' then
        execute format($f$create policy %I on public.%I as restrictive for update to authenticated
                          using (public.get_my_role() in ('approver', 'mat_admin'))
                          with check (public.get_my_role() in ('approver', 'mat_admin'))$f$, 'write_requires_approver_' || c, t);
      else
        execute format($f$create policy %I on public.%I as restrictive for delete to authenticated
                          using (public.get_my_role() in ('approver', 'mat_admin'))$f$, 'write_requires_approver_' || c, t);
      end if;
    end loop;
  end loop;
end $$;

-- 3. D1: a point can only be assigned to someone in the same school.
drop policy if exists "assignee_in_same_school" on public.point_assignments;
create policy "assignee_in_same_school" on public.point_assignments as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.profiles ap
    where ap.id = point_assignments.assignee_user_id and ap.school_id = point_assignments.school_id
  ));

-- 4. D3: contributors cannot add, change or delete evidence on an approved (in_place) point.
--    Exception: the date-only "Confirm still current" review fields stay open to everyone.
--    Raises (does not silently ignore): the UI should never offer this, and an error is clearer
--    than a save that quietly does nothing.
create or replace function public.evidence_entries_protect_approved()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text;
  v_entry uuid;
  v_status text;
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role in ('approver', 'mat_admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  v_entry := case when tg_op = 'INSERT' then new.entry_id else old.entry_id end;
  select status into v_status from entries where id = v_entry;

  if v_status is distinct from 'in_place' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'date_last_reviewed' - 'next_review_due' - 'last_reviewed_by' - 'updated_at')
       = (to_jsonb(old) - 'date_last_reviewed' - 'next_review_due' - 'last_reviewed_by' - 'updated_at') then
    return new;
  end if;

  raise exception 'Evidence on an approved point can only be changed by an approver'
    using errcode = '42501';
end;
$$;

revoke execute on function public.evidence_entries_protect_approved() from public, anon, authenticated;

drop trigger if exists evidence_entries_protect_approved on public.evidence_entries;
create trigger evidence_entries_protect_approved
  before insert or update or delete on public.evidence_entries
  for each row execute function public.evidence_entries_protect_approved();

-- 5. D0 (RPCs): the three approval functions are SECURITY DEFINER and bypass RLS, so they check
--    for the demo account themselves. Bodies are otherwise exactly as in the previous migrations.
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
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
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
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
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

create or replace function public.confirm_entry_approval(p_entry_id uuid, p_approver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_school uuid;
  v_entry_school uuid;
  v_submitted_by uuid;
begin
  if p_approver_id <> auth.uid() then
    raise exception 'approver_id must match the calling user';
  end if;
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
  end if;

  select role, school_id into v_caller_role, v_caller_school from profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('approver', 'mat_admin') then
    raise exception 'Not permitted: approver or mat_admin role required';
  end if;

  select school_id into v_entry_school from entries where id = p_entry_id;
  if v_entry_school is null then
    raise exception 'Entry not found';
  end if;
  if v_entry_school <> v_caller_school then
    raise exception 'Not permitted: entry belongs to a different school';
  end if;

  update entries
  set status = 'in_place', submitted_for_approval_at = null
  where id = p_entry_id and status is distinct from 'in_place'
  returning submitted_by into v_submitted_by;

  if not found then
    return;
  end if;

  insert into point_approval_log (entry_id, school_id, action, actioned_by)
  values (p_entry_id, v_entry_school, 'confirmed', p_approver_id);

  if v_submitted_by is not null then
    insert into approval_notifications (user_id, entry_id)
    values (v_submitted_by, p_entry_id);
  end if;
end;
$$;

-- CREATE OR REPLACE keeps existing privileges; nothing to re-grant.

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed)
--
-- do $$
-- declare t text; c text;
-- begin
--   foreach t in array array['entries','evidence_entries','barriers','barrier_provision_points','barrier_provision_links',
--     'inclusion_strategy_drafts','inclusion_strategy_outcomes','inclusion_strategy_priorities',
--     'inclusion_strategy_priority_barriers','school_context','friction_logs','point_assignments','my_points_queue_state'] loop
--     foreach c in array array['insert','update','delete'] loop
--       execute format('drop policy if exists %I on public.%I', 'no_demo_writes_' || c, t);
--     end loop;
--   end loop;
--   foreach t in array array['barriers','barrier_provision_points','barrier_provision_links','inclusion_strategy_drafts',
--     'inclusion_strategy_outcomes','inclusion_strategy_priorities','inclusion_strategy_priority_barriers','school_context'] loop
--     foreach c in array array['insert','update','delete'] loop
--       execute format('drop policy if exists %I on public.%I', 'write_requires_approver_' || c, t);
--     end loop;
--   end loop;
-- end $$;
-- drop policy if exists "assignee_in_same_school" on public.point_assignments;
-- drop trigger if exists evidence_entries_protect_approved on public.evidence_entries;
-- drop function if exists public.evidence_entries_protect_approved();
-- drop function if exists public.get_my_role();
-- -- the three RPCs: re-run the bodies from 20261008140000_enforce_approval_on_entries.sql (submit, send_back)
-- -- and 20260917120500_confirm_entry_approval_idempotent.sql (confirm) to drop the demo-account check.
-- ---------------------------------------------------------------------------------------
