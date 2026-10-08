-- Change requests on approved points (founder request, 8 Oct 2026).
--
-- Instead of silently blocking, a contributor who wants an approved (in_place) point changed
-- sends a REQUEST (new status + reason). It lands in the approver's queue; the approver
-- accepts (status changes) or declines with a note, and the contributor is notified. The point
-- stays approved until an approver decides.
--
-- This also closes the limitation flagged in the Fix C migration: the entries guard now stops
-- contributors LOWERING an approved point directly, so requesting is the only route.
--
-- All writes to the new tables go through SECURITY DEFINER functions with explicit identity,
-- school and role checks (the same pattern as the approval RPCs); clients can only read.

-- 1. Audit log: allow the three new actions.
alter table public.point_approval_log drop constraint if exists point_approval_log_action_check;
alter table public.point_approval_log add constraint point_approval_log_action_check
  check (action = any (array['submitted', 'confirmed', 'sent_back',
                             'change_requested', 'change_accepted', 'change_declined']));

-- 2. Generic in-app notifications (self-only). Used here for change requests; barrier
--    confirmations will reuse it. The existing approval_notifications table is untouched.
create table if not exists public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists user_notifications_user_unseen on public.user_notifications (user_id) where seen_at is null;

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (seen_at) on public.user_notifications to authenticated;

drop policy if exists "own notifications read" on public.user_notifications;
create policy "own notifications read" on public.user_notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications mark seen" on public.user_notifications;
create policy "own notifications mark seen" on public.user_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. The requests themselves.
create table if not exists public.point_change_requests (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  entry_id         uuid not null references public.entries(id) on delete cascade,
  requested_by     uuid references public.profiles(id) on delete set null,
  requested_status text not null check (requested_status in ('in_progress', 'not_in_place')),
  reason           text not null check (length(btrim(reason)) > 0),
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  decided_by       uuid references public.profiles(id) on delete set null,
  decided_at       timestamptz,
  decision_note    text,
  created_at       timestamptz not null default now()
);
-- At most one open request per point.
create unique index if not exists point_change_requests_one_pending
  on public.point_change_requests (entry_id) where status = 'pending';
create index if not exists point_change_requests_school_pending
  on public.point_change_requests (school_id) where status = 'pending';

alter table public.point_change_requests enable row level security;
revoke all on public.point_change_requests from anon, authenticated;
grant select on public.point_change_requests to authenticated;

-- Approvers/mat_admins see every request in their school; others see only their own.
drop policy if exists "members read change requests" on public.point_change_requests;
create policy "members read change requests" on public.point_change_requests
  for select to authenticated
  using (
    school_id = public.get_my_school_id()
    and (requested_by = auth.uid() or public.get_my_role() in ('approver', 'mat_admin'))
  );

-- 4. Request a change (non-approvers only; approvers just change the status directly).
create or replace function public.request_point_status_change(p_entry_id uuid, p_requested_status text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_school uuid;
  v_name text;
  v_entry_school uuid;
  v_entry_status text;
  v_point uuid;
  v_label text;
  v_req uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
  end if;
  if p_requested_status is null or p_requested_status not in ('in_progress', 'not_in_place') then
    raise exception 'Requested status must be In Progress or Not in Place';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please give a reason for the change';
  end if;

  select role, school_id, btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
    into v_role, v_caller_school, v_name
  from profiles where id = auth.uid();
  if v_role in ('approver', 'mat_admin') then
    raise exception 'Approvers can change the status directly';
  end if;

  select school_id, status, provision_point_id into v_entry_school, v_entry_status, v_point
  from entries where id = p_entry_id;
  if v_entry_school is null or v_caller_school is null or v_entry_school <> v_caller_school then
    raise exception 'Entry not found or not permitted';
  end if;
  if v_entry_status is distinct from 'in_place' then
    raise exception 'Only approved points need a change request';
  end if;

  begin
    insert into point_change_requests (school_id, entry_id, requested_by, requested_status, reason)
    values (v_entry_school, p_entry_id, auth.uid(), p_requested_status, btrim(p_reason))
    returning id into v_req;
  exception when unique_violation then
    raise exception 'A change request for this point is already waiting for an approver';
  end;

  insert into point_approval_log (entry_id, school_id, action, actioned_by, note)
  values (p_entry_id, v_entry_school, 'change_requested', auth.uid(), p_requested_status || ': ' || btrim(p_reason));

  select label into v_label from provision_points where id = v_point;

  insert into user_notifications (user_id, kind, title, body, ref_id)
  select p.id, 'change_requested', 'Change requested',
         coalesce(nullif(v_name, ''), 'A contributor') || ' asked to change "' || coalesce(v_label, 'a point')
           || '" to ' || case p_requested_status when 'in_progress' then 'In Progress' else 'Not in Place' end || '.',
         v_req
  from profiles p
  where p.school_id = v_entry_school and p.role in ('approver', 'mat_admin');

  return v_req;
end;
$$;

-- 5. Withdraw your own pending request.
create or replace function public.cancel_point_status_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if (auth.jwt() ->> 'email') = 'demo@testschool.co.uk' then
    raise exception 'Not permitted in the demo';
  end if;

  update point_change_requests
  set status = 'cancelled', decided_at = now()
  where id = p_request_id and requested_by = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Request not found or no longer pending';
  end if;
end;
$$;

-- 6. Approver decision. Accepting sets the entry status; either way the request is closed, the
--    audit log gets a row, and the requester is notified.
create or replace function public.decide_point_status_change(p_request_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_school uuid;
  v_req point_change_requests%rowtype;
  v_entry_status text;
  v_point uuid;
  v_label text;
  v_status_label text;
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

  select * into v_req from point_change_requests where id = p_request_id for update;
  if not found or v_req.school_id <> v_caller_school then
    raise exception 'Request not found or not permitted';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been dealt with';
  end if;

  select status, provision_point_id into v_entry_status, v_point from entries where id = v_req.entry_id for update;

  if p_accept and v_entry_status = 'in_place' then
    update entries set status = v_req.requested_status where id = v_req.entry_id;
  end if;
  -- If the point was already changed by someone else, accepting just closes the request.

  update point_change_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      decided_by = auth.uid(), decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_request_id;

  insert into point_approval_log (entry_id, school_id, action, actioned_by, note)
  values (v_req.entry_id, v_req.school_id,
          case when p_accept then 'change_accepted' else 'change_declined' end,
          auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  select label into v_label from provision_points where id = v_point;
  v_status_label := case v_req.requested_status when 'in_progress' then 'In Progress' else 'Not in Place' end;

  if v_req.requested_by is not null then
    insert into user_notifications (user_id, kind, title, body, ref_id)
    values (
      v_req.requested_by,
      case when p_accept then 'change_accepted' else 'change_declined' end,
      case when p_accept then 'Change accepted' else 'Change declined' end,
      case when p_accept
           then '"' || coalesce(v_label, 'The point') || '" is now ' || v_status_label || '.'
           else 'Your request to change "' || coalesce(v_label, 'the point') || '" to ' || v_status_label || ' was declined.'
        end
        || coalesce(' Note: ' || nullif(btrim(coalesce(p_note, '')), ''), ''),
      p_request_id
    );
  end if;
end;
$$;

revoke execute on function public.request_point_status_change(uuid, text, text) from public, anon;
revoke execute on function public.cancel_point_status_change(uuid)              from public, anon;
revoke execute on function public.decide_point_status_change(uuid, boolean, text) from public, anon;
grant  execute on function public.request_point_status_change(uuid, text, text) to authenticated, service_role;
grant  execute on function public.cancel_point_status_change(uuid)              to authenticated, service_role;
grant  execute on function public.decide_point_status_change(uuid, boolean, text) to authenticated, service_role;

-- 7. Entries guard (extends 20261008140000): a non-approver can no longer move a point into OR
--    out of in_place with a direct write. Still quiet (keeps the old value) so stale cached
--    saves keep working. Moving out of in_place now goes through the request above.
create or replace function public.entries_protect_approval_columns()
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
    if (new.status = 'in_place') is distinct from (old.status = 'in_place') then
      new.status := old.status;
    end if;
    new.submitted_for_approval_at := old.submitted_for_approval_at;
    new.submitted_by              := old.submitted_by;
    new.send_back_note            := old.send_back_note;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed)
--
-- drop function if exists public.request_point_status_change(uuid, text, text);
-- drop function if exists public.cancel_point_status_change(uuid);
-- drop function if exists public.decide_point_status_change(uuid, boolean, text);
-- drop table if exists public.point_change_requests;
-- drop table if exists public.user_notifications;
-- alter table public.point_approval_log drop constraint if exists point_approval_log_action_check;
-- alter table public.point_approval_log add constraint point_approval_log_action_check
--   check (action = any (array['submitted', 'confirmed', 'sent_back']));   -- fails if change_* rows exist; delete them first
-- -- and re-run the entries_protect_approval_columns() definition from 20261008140000_enforce_approval_on_entries.sql
-- ---------------------------------------------------------------------------------------
