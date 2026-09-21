-- Inclusion Strategy wizard rebuild (barrier-first, DfE template) — additive.
-- Nothing existing is dropped or renamed. budgeted_cost, funding_source and
-- inclusion_strategy_drafts.intended_outcomes stay in place, unused by the new steps.
-- Old inclusion_strategy_priorities rows with no barrier link stay in the database
-- untouched by this migration; the app decides what to do with them (confirmed live:
-- Kew Woods Primary has 166 such rows, Springwell Academy has 4). A row with real content
-- (non-empty activity_description, or a cost, or a funding source) surfaces read-only in
-- the wizard's new "Unlinked activities" tray with a one-click way to link it to a barrier;
-- a bare, content-free stub row stays invisible either way.

begin;

-- 1. principle was NOT NULL with no CHECK constraint (confirmed live) — the new
--    barrier-first model has no non-invented value for an activity whose barrier has no
--    linked provision points (a "None of these fit" barrier). Approved: make it nullable
--    rather than force a guessed value. Existing rows/values are untouched by this ALTER.
alter table inclusion_strategy_priorities
  alter column principle drop not null;

-- 2. Universal/Targeted on a priority (activity) row — mirrors provision_points'
--    own CHECK values exactly ('universal' / 'targeted'), confirmed live.
alter table inclusion_strategy_priorities
  add column universal_or_targeted text
    check (universal_or_targeted in ('universal', 'targeted'));

-- 3. Per-barrier free-text trend/theme notes, keyed by barrier id, and the (optional,
--    year-two-onward) previous-year review text — both live on the draft, not per-barrier
--    rows, since a barrier can be shared across strategy years.
alter table inclusion_strategy_drafts
  add column barrier_notes jsonb not null default '{}'::jsonb;

alter table inclusion_strategy_drafts
  add column previous_year_review text;

-- 4. Many-to-many: which barriers a given activity (priority) addresses. An activity can
--    address more than one barrier ("also addresses barrier" ticks); a barrier can have
--    many activities. Deleting a priority or a barrier removes just the link row — never
--    the other side — matching barrier_provision_points' own barrier_id cascade.
create table inclusion_strategy_priority_barriers (
  id          uuid primary key default gen_random_uuid(),
  priority_id uuid not null references inclusion_strategy_priorities(id) on delete cascade,
  barrier_id  uuid not null references barriers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (priority_id, barrier_id)
);

alter table inclusion_strategy_priority_barriers enable row level security;

create index inclusion_strategy_priority_barriers_barrier_id_idx
  on inclusion_strategy_priority_barriers (barrier_id);

-- RLS mirrors inclusion_strategy_priorities' own policies, joined through the priority to
-- its draft's school_id. No MAT-admin policy — nothing reads this table at MAT level yet;
-- add one with an explicit role check when something does, rather than the no-role-check
-- pattern already flagged as a problem elsewhere in this schema.
create policy inclusion_strategy_priority_barriers_select on inclusion_strategy_priority_barriers
  for select using (
    exists (
      select 1 from inclusion_strategy_priorities p
      join inclusion_strategy_drafts d on d.id = p.strategy_id
      where p.id = inclusion_strategy_priority_barriers.priority_id
        and d.school_id = get_my_school_id()
    )
  );

-- Insert must hold for BOTH sides of the link: the priority's own draft school, and the
-- barrier's school. This is not just theoretical — barriers' own MAT-admin select policy
-- has no role check (a pre-existing, already-flagged pattern), so any profile whose mat_id
-- matches can already READ a sibling school's barrier id and its real value. Without the
-- second check here, that same caller could then reference it in an insert on this table,
-- linking their own priority to a barrier they don't own.
create policy inclusion_strategy_priority_barriers_insert on inclusion_strategy_priority_barriers
  for insert with check (
    exists (
      select 1 from inclusion_strategy_priorities p
      join inclusion_strategy_drafts d on d.id = p.strategy_id
      where p.id = inclusion_strategy_priority_barriers.priority_id
        and d.school_id = get_my_school_id()
    )
    and exists (
      select 1 from barriers b
      where b.id = inclusion_strategy_priority_barriers.barrier_id
        and b.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_priority_barriers_delete on inclusion_strategy_priority_barriers
  for delete using (
    exists (
      select 1 from inclusion_strategy_priorities p
      join inclusion_strategy_drafts d on d.id = p.strategy_id
      where p.id = inclusion_strategy_priority_barriers.priority_id
        and d.school_id = get_my_school_id()
    )
  );

-- 5. Intended outcomes as rows (outcome + success criteria), replacing the single free-text
--    inclusion_strategy_drafts.intended_outcomes column for new strategies. That column is
--    left in place, unused (confirmed live: zero real-school drafts have any text in it).
create table inclusion_strategy_outcomes (
  id               uuid primary key default gen_random_uuid(),
  strategy_id      uuid not null references inclusion_strategy_drafts(id) on delete cascade,
  outcome          text not null,
  success_criteria text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table inclusion_strategy_outcomes enable row level security;

create index inclusion_strategy_outcomes_strategy_id_idx
  on inclusion_strategy_outcomes (strategy_id);

-- RLS mirrors inclusion_strategy_priorities' own policies (joined directly to the draft).
-- No MAT-admin policy, same reasoning as inclusion_strategy_priority_barriers above.
create policy inclusion_strategy_outcomes_select on inclusion_strategy_outcomes
  for select using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_outcomes.strategy_id
        and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_outcomes_insert on inclusion_strategy_outcomes
  for insert with check (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_outcomes.strategy_id
        and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_outcomes_update on inclusion_strategy_outcomes
  for update using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_outcomes.strategy_id
        and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_outcomes_delete on inclusion_strategy_outcomes
  for delete using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_outcomes.strategy_id
        and d.school_id = get_my_school_id()
    )
  );

commit;
