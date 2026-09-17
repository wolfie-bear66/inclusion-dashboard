-- My Points onboarding queue: per-user, per-point skip/confirm tracking.
-- Independent of point_assignments (whose rows get deleted+recreated on
-- reassignment — see Phase 0 diagnostic, session addendum 2), so this state
-- survives reassignment and also covers not-yet-assigned suggested points,
-- which have no point_assignments row to attach state to at all.
create table if not exists public.my_points_queue_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  provision_point_id uuid not null references public.provision_points(id) on delete cascade,
  skip_count integer not null default 0,
  acknowledged_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, school_id, provision_point_id)
);

alter table public.my_points_queue_state enable row level security;

-- Mirrors point_assignments' self_assign_insert qual/with_check shape exactly.
create policy "self_select_queue_state" on public.my_points_queue_state
  for select
  using (user_id = auth.uid());

create policy "self_insert_queue_state" on public.my_points_queue_state
  for insert
  with check (
    user_id = auth.uid()
    and school_id = (select profiles.school_id from profiles where profiles.id = auth.uid())
  );

create policy "self_update_queue_state" on public.my_points_queue_state
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and school_id = (select profiles.school_id from profiles where profiles.id = auth.uid())
  );

create trigger set_updated_at
  before update on public.my_points_queue_state
  for each row execute function public.update_updated_at();
