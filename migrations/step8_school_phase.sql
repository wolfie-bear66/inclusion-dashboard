-- step8_school_phase.sql
-- Adds phase column to schools table with a CHECK constraint.
-- Valid values: primary | secondary | all_through | special

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS phase TEXT
  CHECK (phase IN ('primary', 'secondary', 'all_through', 'special'));

-- Backfill demo/pilot schools
UPDATE public.schools SET phase = 'primary'   WHERE name = 'Springwell Academy';
UPDATE public.schools SET phase = 'secondary' WHERE name = 'Rydell High';
UPDATE public.schools SET phase = 'primary'   WHERE name = 'Sunnydale Primary';
UPDATE public.schools SET phase = 'primary'   WHERE name = 'Bayside Primary';
UPDATE public.schools SET phase = 'primary'   WHERE name = 'Capeside Primary';
UPDATE public.schools SET phase = 'secondary' WHERE name = 'North Shore High';
