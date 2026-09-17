-- Submitter tracking for the approval flow, and a notification when it's confirmed.
-- Phase 0 diagnostic found neither entries nor point_approval_log reliably records who
-- submitted an entry (point_approval_log's actioned_by is reused per action type, and its
-- own log insert wasn't atomic with the entries write it followed), and confirmed live that
-- point_assignments.assignee_user_id is not a safe stand-in (already diverged from the real
-- submitter in 2 of 4 real rows checked).
alter table public.entries
  add column submitted_by uuid null references public.profiles(id);

create table if not exists public.approval_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  approved_at timestamptz not null default now(),
  seen_at timestamptz null
);

alter table public.approval_notifications enable row level security;

-- Same shape as point_assignments' self_assign_insert.
create policy "self_select_approval_notifications" on public.approval_notifications
  for select
  using (user_id = auth.uid());

create policy "self_insert_approval_notifications" on public.approval_notifications
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from profiles where profiles.id = auth.uid())
  );

create policy "self_update_approval_notifications" on public.approval_notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
