-- Atomic replacements for the three point_approval_log write sites found in Phase 0 to all
-- share the same bug: the entries write committed, then a separate point_approval_log
-- insert was non-fatal (console.error only, no rollback) — a failure there left the entry
-- looking submitted/confirmed/sent-back with no log row at all.

-- INVOKER (default) — the caller already has sufficient RLS grants (any school member may
-- submit their own school's entries); no privilege escalation needed. The submitting_user_id
-- must match the caller so submitted_by can't be spoofed to attribute work to someone else.
create or replace function public.submit_entry_for_approval(p_entry_id uuid, p_submitting_user_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if p_submitting_user_id <> auth.uid() then
    raise exception 'submitting_user_id must match the calling user';
  end if;

  update entries
  set submitted_for_approval_at = now(), submitted_by = p_submitting_user_id
  where id = p_entry_id
  returning school_id into v_school_id;

  if v_school_id is null then
    raise exception 'Entry not found or not permitted';
  end if;

  insert into point_approval_log (entry_id, school_id, action, actioned_by)
  values (p_entry_id, v_school_id, 'submitted', p_submitting_user_id);
end;
$$;

grant execute on function public.submit_entry_for_approval(uuid, uuid) to authenticated;

-- SECURITY DEFINER: required to insert a notification for the SUBMITTER, a different user
-- than the calling approver — approval_notifications' own RLS is deliberately self-only
-- (matches point_assignments' self_assign_insert shape) and must not be loosened just for
-- this. Because DEFINER bypasses RLS entirely, this function re-enforces both the
-- approver/mat_admin role check and same-school scoping itself, matching the existing
-- entries UPDATE policy's own restriction (own profile.school_id only) rather than
-- broadening it — a contributor calling this RPC directly (bypassing the UI gate, which
-- only exists in App.jsx) must not be able to self-approve.
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

  select role, school_id into v_caller_role, v_caller_school from profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('approver', 'mat_admin') then
    raise exception 'Not permitted: approver or mat_admin role required';
  end if;

  select school_id, submitted_by into v_entry_school, v_submitted_by from entries where id = p_entry_id;
  if v_entry_school is null then
    raise exception 'Entry not found';
  end if;
  if v_entry_school <> v_caller_school then
    raise exception 'Not permitted: entry belongs to a different school';
  end if;

  update entries
  set status = 'in_place', submitted_for_approval_at = null
  where id = p_entry_id;

  insert into point_approval_log (entry_id, school_id, action, actioned_by)
  values (p_entry_id, v_entry_school, 'confirmed', p_approver_id);

  if v_submitted_by is not null then
    insert into approval_notifications (user_id, entry_id)
    values (v_submitted_by, p_entry_id);
  end if;
end;
$$;

grant execute on function public.confirm_entry_approval(uuid, uuid) to authenticated;

-- INVOKER is sufficient here (no cross-user write), but keeps the same role check as
-- confirm_entry_approval for the same reason: an RPC is callable directly, not just from
-- the gated UI screen.
create or replace function public.send_back_entry_approval(p_entry_id uuid, p_approver_id uuid, p_note text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_caller_role text;
  v_caller_school uuid;
  v_entry_school uuid;
begin
  if p_approver_id <> auth.uid() then
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

grant execute on function public.send_back_entry_approval(uuid, uuid, text) to authenticated;
