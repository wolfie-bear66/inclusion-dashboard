-- Create Inclusion Strategy wizard: draft + priorities tables (first-year-only, no carry-forward)

create table if not exists inclusion_strategy_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  academic_year_label text,
  review_date date,
  authorised_by text,
  barrier_ids uuid[] default '{}',
  statement_of_intent text,
  intended_outcomes text,
  further_information text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inclusion_strategy_priorities (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references inclusion_strategy_drafts(id) on delete cascade,
  principle text not null,
  source_point_id uuid references provision_points(id),
  point_description text,
  activity_description text,
  budgeted_cost numeric,
  funding_source text check (funding_source in (
    'pupil_premium', 'send_budget', 'inclusive_mainstream_fund', 'sport_premium', 'school_general_budget'
  )),
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index if not exists inclusion_strategy_priorities_strategy_id_idx
  on inclusion_strategy_priorities(strategy_id);

-- updated_at trigger, matching the existing barriers pattern
create or replace function update_inclusion_strategy_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger inclusion_strategy_drafts_updated_at
before update on inclusion_strategy_drafts
for each row execute function update_inclusion_strategy_drafts_updated_at();

-- RLS
alter table inclusion_strategy_drafts enable row level security;
alter table inclusion_strategy_priorities enable row level security;

create policy inclusion_strategy_drafts_select on inclusion_strategy_drafts
  for select using (school_id = get_my_school_id());

create policy inclusion_strategy_drafts_insert on inclusion_strategy_drafts
  for insert with check (school_id = get_my_school_id());

create policy inclusion_strategy_drafts_update on inclusion_strategy_drafts
  for update using (school_id = get_my_school_id());

create policy inclusion_strategy_drafts_delete on inclusion_strategy_drafts
  for delete using (school_id = get_my_school_id());

create policy "inclusion_strategy_drafts_select_mat_admin" on inclusion_strategy_drafts
  for select using (
    school_id in (
      select s.id from schools s
      join profiles p on p.mat_id = s.mat_id
      where p.id = auth.uid()
    )
  );

create policy inclusion_strategy_priorities_select on inclusion_strategy_priorities
  for select using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_priorities.strategy_id
      and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_priorities_insert on inclusion_strategy_priorities
  for insert with check (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_priorities.strategy_id
      and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_priorities_update on inclusion_strategy_priorities
  for update using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_priorities.strategy_id
      and d.school_id = get_my_school_id()
    )
  );

create policy inclusion_strategy_priorities_delete on inclusion_strategy_priorities
  for delete using (
    exists (
      select 1 from inclusion_strategy_drafts d
      where d.id = inclusion_strategy_priorities.strategy_id
      and d.school_id = get_my_school_id()
    )
  );

create policy "inclusion_strategy_priorities_select_mat_admin" on inclusion_strategy_priorities
  for select using (
    strategy_id in (
      select d.id from inclusion_strategy_drafts d
      join schools s on s.id = d.school_id
      join profiles p on p.mat_id = s.mat_id
      where p.id = auth.uid()
    )
  );
