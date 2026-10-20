-- Fix: Approve silently did nothing for a point that was waiting for approval but whose
-- status was already 'in_place' (found in AJY Academy, Phase 0, 20 Oct 2026).
--
-- Cause: confirm_entry_approval (20260917120500) used `status is distinct from 'in_place'` as
-- its double-click guard. A point with submitted_for_approval_at set AND status already
-- 'in_place' matched zero rows, the function returned normally (no error), the app assumed
-- success, and the waiting stamp was never cleared, so the dashboard count stayed.
--
-- Fix: the guard is now the waiting stamp itself. The UPDATE acts only on a row that is
-- waiting (submitted_for_approval_at is not null); it sets status to 'in_place' and clears the
-- stamp. Whenever a row was actually updated, the 'confirmed' log row and the submitter
-- notification are written, including when the status was already 'in_place'. A second call
-- (double-click, or two approvers) finds the stamp already cleared, matches zero rows and does
-- nothing. Postgres serialises concurrent UPDATEs on the row, so this stays race-safe.
--
-- Unchanged from the live function: signature, SECURITY DEFINER, search_path, the caller
-- identity check, the demo-login block, the approver / mat_admin role check and the
-- same-school check. Grants are unchanged (CREATE OR REPLACE keeps them).
-- log_status_change is untouched: it logs only when status actually changes, so clearing the
-- stamp on an already in_place row logs nothing in activity_log.
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
  where id = p_entry_id and submitted_for_approval_at is not null
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
