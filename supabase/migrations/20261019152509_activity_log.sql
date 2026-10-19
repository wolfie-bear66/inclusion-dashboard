-- Recent activity feed, Stage 1 (19 Oct 2026): activity_log table, three trigger functions, RLS.
--
-- The feed's ONLY source. Written by database triggers (SECURITY DEFINER), never by client code,
-- because status and evidence writes happen in many places (evidence modal, bootstrap wizard,
-- approval RPCs). Nothing is backfilled: the feed starts empty.
--
--   evidence_entries AFTER INSERT  -> evidence_added, or evidence_first for the actor's first ever
--   entries AFTER INSERT/UPDATE    -> status_changed (any direction; first-time set has status_from null)
--   evidence_entries AFTER DELETE  -> matching log rows become "Evidence Removed" and lose their link
--
-- Edits to evidence do NOT log (there is no UPDATE trigger on evidence_entries). The evidence
-- modal saves with insert (new) or update (edit), never upsert, so an edit cannot appear as an add;
-- `entries` is saved by upsert, and an upsert that hits an existing row fires the UPDATE trigger
-- (not the INSERT one), so a status that did not change logs nothing.
--
-- Actor = auth.uid(). RPCs (confirm_entry_approval etc.) are SECURITY DEFINER but keep the caller's
-- JWT, so the approver is recorded. auth.uid() is NULL for the service role, the SQL editor and
-- manual seed scripts: those still log, with actor_id and actor_name NULL (the feed shows
-- "A team member"). No edge function writes entries or evidence_entries today.

create table public.activity_log (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_name     text,                         -- snapshot at the time; survives the person's removal
  event_type     text not null check (event_type in ('evidence_added', 'evidence_first', 'status_changed')),
  entry_id       uuid,                         -- no FK: the log must never block deleting an entry
  entry_label    text,                         -- snapshot of provision_points.label
  principle      text,                         -- snapshot of provision_points.principle
  evidence_id    uuid,                         -- no FK / no cascade; cleared when the evidence is deleted
  evidence_title text,                         -- snapshot; 'Evidence Removed' after deletion
  status_from    text check (status_from in ('in_place', 'in_progress', 'not_in_place')),
  status_to      text check (status_to in ('in_place', 'in_progress', 'not_in_place')),
  removed        boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint activity_log_status_shape check ((event_type = 'status_changed') = (status_to is not null))
);

create index activity_log_school_created_idx on public.activity_log (school_id, created_at desc);
create index activity_log_evidence_idx on public.activity_log (evidence_id) where evidence_id is not null;
create index activity_log_actor_idx on public.activity_log (actor_id, event_type);

-- ---------------------------------------------------------------------------------------
-- RLS + grants. Supabase grants ALL on new public tables to anon/authenticated by default,
-- so revoke explicitly. Read-only for signed-in users; there are no insert/update/delete
-- policies or grants at all (so the demo account cannot write either).
-- ---------------------------------------------------------------------------------------
alter table public.activity_log enable row level security;

revoke all on public.activity_log from public, anon, authenticated;
grant select on public.activity_log to authenticated;

-- Members read their own school's rows (same shape as the entries policy).
create policy "members read own school activity"
  on public.activity_log for select to authenticated
  using (school_id = (select p.school_id from public.profiles p where p.id = auth.uid()));

-- mat_admins read every school in their MAT (same shape as entries_select_mat_admin).
create policy "mat members read mat school activity"
  on public.activity_log for select to authenticated
  using (school_id in (
    select s.id
    from public.schools s
    join public.profiles p on p.mat_id = s.mat_id
    where p.id = auth.uid()
  ));

-- ---------------------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------------------
create or replace function public.activity_actor_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(concat_ws(' ', nullif(btrim(first_name), ''), nullif(btrim(last_name), ''))), '')
  from public.profiles where id = p_uid
$$;

create or replace function public.log_evidence_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_school    uuid;
  v_label     text;
  v_principle text;
  v_event     text := 'evidence_added';
begin
  select e.school_id, pp.label, pp.principle
    into v_school, v_label, v_principle
  from public.entries e
  join public.provision_points pp on pp.id = e.provision_point_id
  where e.id = NEW.entry_id;

  if v_school is null then
    return null;
  end if;

  if v_uid is not null and not exists (
    select 1 from public.activity_log
    where actor_id = v_uid and event_type in ('evidence_added', 'evidence_first')
  ) then
    v_event := 'evidence_first';
  end if;

  insert into public.activity_log
    (school_id, actor_id, actor_name, event_type, entry_id, entry_label, principle, evidence_id, evidence_title)
  values
    (v_school, v_uid, public.activity_actor_name(v_uid), v_event, NEW.entry_id, v_label, v_principle,
     NEW.id, coalesce(nullif(btrim(NEW.provision_name), ''), v_label));

  return null;
end;
$$;

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_label     text;
  v_principle text;
begin
  if NEW.status is null then
    return null;                       -- clearing a status is not logged (status_to is required)
  end if;
  if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
    return null;                       -- upsert that changed nothing: no line
  end if;

  select pp.label, pp.principle into v_label, v_principle
  from public.provision_points pp where pp.id = NEW.provision_point_id;

  insert into public.activity_log
    (school_id, actor_id, actor_name, event_type, entry_id, entry_label, principle, status_from, status_to)
  values
    (NEW.school_id, v_uid, public.activity_actor_name(v_uid), 'status_changed', NEW.id, v_label, v_principle,
     case when TG_OP = 'UPDATE' then OLD.status else null end, NEW.status);

  return null;
end;
$$;

create or replace function public.log_evidence_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activity_log
  set removed = true,
      evidence_title = 'Evidence Removed',
      evidence_id = null
  where evidence_id = OLD.id;
  return null;
end;
$$;

-- Trigger functions only ever run as triggers.
revoke execute on function public.activity_actor_name(uuid) from public, anon, authenticated;
revoke execute on function public.log_evidence_added()   from public, anon, authenticated;
revoke execute on function public.log_status_change()    from public, anon, authenticated;
revoke execute on function public.log_evidence_removed() from public, anon, authenticated;

create trigger activity_log_evidence_added
  after insert on public.evidence_entries
  for each row execute function public.log_evidence_added();

create trigger activity_log_status_change
  after insert or update on public.entries
  for each row execute function public.log_status_change();

create trigger activity_log_evidence_removed
  after delete on public.evidence_entries
  for each row execute function public.log_evidence_removed();

-- ---------------------------------------------------------------------------------------
-- ROLLBACK:
--   drop trigger if exists activity_log_evidence_added   on public.evidence_entries;
--   drop trigger if exists activity_log_evidence_removed on public.evidence_entries;
--   drop trigger if exists activity_log_status_change    on public.entries;
--   drop function if exists public.log_evidence_added(), public.log_status_change(),
--                           public.log_evidence_removed(), public.activity_actor_name(uuid);
--   drop table if exists public.activity_log;
-- ---------------------------------------------------------------------------------------
