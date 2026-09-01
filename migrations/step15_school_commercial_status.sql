-- Adds commercial/pipeline tracking fields to schools, for the admin dashboard.
-- annual_price is stored as an explicit numeric rather than derived from price_tier,
-- because founder pricing is locked in per-school on its confirmation date and can
-- differ from the current band even as pricing changes later (grandfathering).

alter table schools
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'paid', 'churned')),
  add column if not exists price_tier text,           -- display label, e.g. 'Band 1 (£500)'
  add column if not exists annual_price numeric,        -- actual locked-in £/year, null until confirmed
  add column if not exists confirmed_at timestamptz;    -- when it moved to paid

comment on column schools.subscription_status is 'Pipeline stage: trial (default), paid (confirmed), churned';
comment on column schools.annual_price is 'Locked-in annual price at time of confirmation — not recalculated if pricing bands change later';
