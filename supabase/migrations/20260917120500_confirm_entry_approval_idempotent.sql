-- confirm_entry_approval had no guard against firing twice for the same entry — a double
-- click, or two approvers acting near-simultaneously, would have inserted a second
-- 'confirmed' point_approval_log row and a second approval_notifications row every time.
-- Fixed by making the entries UPDATE itself the guard, not a separate SELECT-then-check
-- (which would still race under two truly concurrent calls): Postgres serializes concurrent
-- UPDATEs on the same row, so whichever call commits first flips status to in_place; the
-- second re-evaluates the WHERE clause against the now-committed row, matches zero rows, and
-- exits as a no-op (via FOUND) before logging or notifying anything.
-- Tested live: called this RPC twice in a row via a real authenticated session against the
-- same entry_id — exactly one point_approval_log row and one approval_notifications row
-- existed afterward.
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
