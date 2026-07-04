-- step9_expert_engagement_evidence.sql
-- Adds a generalisable evidence_type + structured_detail (JSONB) pair to evidence_entries.
-- First consumer: "Experts at Hand service accessed and used" (f8509db3-b3d7-44a8-a061-b6f8a05848f1).
-- Not a one-off for this point — evidence_type stays 'standard' with structured_detail null
-- for every other provision point.

ALTER TABLE public.evidence_entries
  ADD COLUMN evidence_type TEXT NOT NULL DEFAULT 'standard'
  CHECK (evidence_type IN ('standard', 'expert_engagement'));

ALTER TABLE public.evidence_entries
  ADD COLUMN structured_detail JSONB NULL;

-- structured_detail shape for evidence_type = 'expert_engagement':
-- {
--   "professional_type": "salt | ot | educational_psychologist | qtod_qtvi | camhs_mhst | other",
--   "commissioning_route": "nhs_icb | local_authority | school_funded | mat_commissioned",
--   "activity_type": "individual_casework | group_work | whole_setting_audit | staff_cpd",
--   "pupils_reached": number | null,
--   "report_received": boolean
-- }

-- funding_source is a CHECK constraint on plain text, not a Postgres enum type —
-- drop and recreate with 'experts_at_hand' added. Only evidence_entries.funding_source
-- is read/written by the app; entries.funding_source is an unused duplicate and is left alone.
ALTER TABLE public.evidence_entries
  DROP CONSTRAINT evidence_entries_funding_source_check;

ALTER TABLE public.evidence_entries
  ADD CONSTRAINT evidence_entries_funding_source_check
  CHECK (funding_source = ANY (ARRAY[
    'pupil_premium'::text,
    'send_budget'::text,
    'inclusive_mainstream_fund'::text,
    'sport_premium'::text,
    'school_general_budget'::text,
    'experts_at_hand'::text
  ]));
