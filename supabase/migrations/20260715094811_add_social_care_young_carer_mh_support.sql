-- Adds three new student group tags: Social Care, Young Carer, Mental Health Support.
-- Additive only — no existing columns, constraints, or rows are touched.
--
-- Note: this is the first committed DDL migration for the grp_*/reach_* column
-- family on evidence_entries — those original 7 groups (SEND/PP/EAL/FSM/LAC/WWC/Other)
-- predate this repo's migration history and were created directly against the live
-- Supabase instance. Column shapes below were verified live: grp_* are
-- boolean not null default false, reach_* are nullable integers with no default.
--
-- entries.grp_* is confirmed dead/legacy (fetched but never read or written by any
-- current code path — see TASKS.md Session 46) — intentionally NOT extended here.

ALTER TABLE public.evidence_entries ADD COLUMN grp_social_care BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.evidence_entries ADD COLUMN grp_young_carer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.evidence_entries ADD COLUMN grp_mental_health_support BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.evidence_entries ADD COLUMN reach_social_care INTEGER;
ALTER TABLE public.evidence_entries ADD COLUMN reach_young_carer INTEGER;
ALTER TABLE public.evidence_entries ADD COLUMN reach_mental_health_support INTEGER;

-- Cohort-size denominators for % reach, matching pp_count/send_count/etc. exactly
-- (verified live: those columns are integer, always populated on existing rows).
ALTER TABLE public.school_context ADD COLUMN social_care_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.school_context ADD COLUMN young_carer_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.school_context ADD COLUMN mental_health_support_count INTEGER NOT NULL DEFAULT 0;
