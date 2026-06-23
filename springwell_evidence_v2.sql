-- springwell_evidence_v2.sql
-- Enriches Springwell Academy evidence entries for categories:
--   Staff Training & CPD, External Partnership,
--   Family & Community Engagement, Direct Provision for Students
-- School ID: 00000000-0000-0000-0000-000000000001
-- Safe to re-run: WHERE NOT EXISTS guards throughout.

DO $$
DECLARE
  v_school_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- ─────────────────────────────────────────────────────────────────
-- 1. Ensure entries exist (status = complete) for all provision
--    points in the four heat-map categories where Springwell has none.
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  'complete'
FROM public.provision_points pp
WHERE pp.category IN (
    'Staff Training & CPD',
    'External Partnership',
    'Family & Community Engagement',
    'Direct Provision for Students'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.entries e
    WHERE e.school_id        = v_school_id
      AND e.provision_point_id = pp.id
  );

-- Also upgrade any existing 'not_started' entries in these categories to complete
UPDATE public.entries e
SET status = 'complete'
FROM public.provision_points pp
WHERE e.provision_point_id = pp.id
  AND e.school_id          = v_school_id
  AND e.status             = 'not_started'
  AND pp.category IN (
      'Staff Training & CPD',
      'External Partnership',
      'Family & Community Engagement',
      'Direct Provision for Students'
  );

END $$;


-- ─────────────────────────────────────────────────────────────────
-- 2. STAFF TRAINING & CPD — add one evidence entry per provision point
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.evidence_entries (
  entry_id,
  provision_name,
  brief_description,
  indicator_type,
  provision_category,
  delivered_by,
  send_tiers,
  date_started,
  date_last_reviewed,
  next_review_due,
  funding_source,
  cost,
  review_cycle,
  evidence_notes,
  intended_outcomes,
  impact_on_outcomes,
  grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
  reach_total, reach_send, reach_pp
)
SELECT
  e.id,
  pp.label,
  'Springwell CPD programme — whole-staff training delivered in line with statutory inclusion requirements and SEND Code of Practice.',
  'Whole School',
  'Staff Training & CPD',
  'SENCO / External Trainer',
  'All tiers',
  '2025-09-02',
  '2026-01-15',
  '2026-07-15',
  'Core budget',
  450.00,
  'Annual',
  'Attendance registers, CPD log and staff feedback forms held on CPOMS. Training delivered across two INSET days and four twilight sessions.',
  'All teaching and support staff to demonstrate updated knowledge of SEND identification, graduated approach and high-quality inclusive teaching.',
  'Staff confidence survey (pre/post) shows 87% improvement. Reduction in SEND referrals requiring external assessment by 14% this term.',
  true, true, false, false, false, false, false,
  68, 12, 8
FROM public.entries e
JOIN public.provision_points pp ON e.provision_point_id = pp.id
WHERE e.school_id    = '00000000-0000-0000-0000-000000000001'
  AND pp.category    = 'Staff Training & CPD'
  AND NOT EXISTS (
    SELECT 1 FROM public.evidence_entries ee WHERE ee.entry_id = e.id
  );


-- ─────────────────────────────────────────────────────────────────
-- 3. EXTERNAL PARTNERSHIP — add one evidence entry per provision point
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.evidence_entries (
  entry_id,
  provision_name,
  brief_description,
  indicator_type,
  provision_category,
  delivered_by,
  send_tiers,
  date_started,
  date_last_reviewed,
  next_review_due,
  funding_source,
  cost,
  review_cycle,
  evidence_notes,
  intended_outcomes,
  impact_on_outcomes,
  grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
  reach_total, reach_send, reach_pp, reach_lac
)
SELECT
  e.id,
  pp.label,
  'Documented partnership agreement with external specialist agency. Referral pathway and service level agreement in place.',
  'Targeted',
  'External Partnership',
  'External specialist / SENCO',
  'Tiers 2–3',
  '2025-09-15',
  '2026-02-10',
  '2026-09-10',
  'SEND notional budget',
  1200.00,
  'Termly',
  'SLA on file, signed January 2026. Referral log maintained in CPOMS. Named contact at partner agency: updated each half-term. Minutes of multi-agency meetings held termly.',
  'Timely access to specialist advice and intervention for students at Tiers 2 and 3 of the graduated approach. Reduced waiting times for CAMHS and EP assessments.',
  'Average time to specialist referral reduced from 11 weeks to 5 weeks. 9 students supported via external agency this academic year — 6 with documented improved outcomes.',
  true, true, false, false, true, false, false,
  24, 14, 6, 4
FROM public.entries e
JOIN public.provision_points pp ON e.provision_point_id = pp.id
WHERE e.school_id    = '00000000-0000-0000-0000-000000000001'
  AND pp.category    = 'External Partnership'
  AND NOT EXISTS (
    SELECT 1 FROM public.evidence_entries ee WHERE ee.entry_id = e.id
  );


-- ─────────────────────────────────────────────────────────────────
-- 4. FAMILY & COMMUNITY ENGAGEMENT — add one evidence entry per point
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.evidence_entries (
  entry_id,
  provision_name,
  brief_description,
  indicator_type,
  provision_category,
  delivered_by,
  send_tiers,
  date_started,
  date_last_reviewed,
  next_review_due,
  funding_source,
  cost,
  review_cycle,
  evidence_notes,
  intended_outcomes,
  impact_on_outcomes,
  grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
  reach_total, reach_send, reach_pp, reach_eal, reach_fsm
)
SELECT
  e.id,
  pp.label,
  'Structured programme of family engagement including parent workshops, translated communications and community liaison. ',
  'Whole School',
  'Family & Community Engagement',
  'Family Liaison Officer / SENCO',
  'All tiers',
  '2025-09-01',
  '2026-03-05',
  '2026-07-01',
  'Pupil premium / core budget',
  320.00,
  'Termly',
  'Parent workshop attendance log (41 families attended across three sessions). Communication translated into 4 languages. EAL parent drop-in held monthly. Community link volunteer log maintained.',
  'Families of SEND and disadvantaged students to feel informed and included in their child's provision planning. EAL families to receive timely information in accessible format.',
  'Parent survey: 79% of SEND families report feeling confident about their child's provision (up from 54% last year). EAL workshop pilot rated 4.6/5 by attendees.',
  true, true, true, true, false, false, false,
  52, 11, 16, 9, 14
FROM public.entries e
JOIN public.provision_points pp ON e.provision_point_id = pp.id
WHERE e.school_id    = '00000000-0000-0000-0000-000000000001'
  AND pp.category    = 'Family & Community Engagement'
  AND NOT EXISTS (
    SELECT 1 FROM public.evidence_entries ee WHERE ee.entry_id = e.id
  );


-- ─────────────────────────────────────────────────────────────────
-- 5. DIRECT PROVISION FOR STUDENTS — add one evidence entry per point
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.evidence_entries (
  entry_id,
  provision_name,
  brief_description,
  indicator_type,
  provision_category,
  delivered_by,
  send_tiers,
  date_started,
  date_last_reviewed,
  next_review_due,
  funding_source,
  cost,
  review_cycle,
  evidence_notes,
  intended_outcomes,
  impact_on_outcomes,
  grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
  reach_total, reach_send, reach_pp, reach_fsm, reach_lac,
  pupils_reached
)
SELECT
  e.id,
  pp.label,
  'Direct in-school provision delivered by trained staff to identified students. Includes small-group and 1:1 interventions with documented outcomes.',
  'Student-Facing',
  'Direct Provision for Students',
  'Teaching assistant / SENCO / Pastoral lead',
  'Tiers 1–3',
  '2025-09-02',
  '2026-04-22',
  '2026-07-10',
  'SEND notional budget / Pupil premium',
  780.00,
  'Half-termly',
  'Provision map updated February 2026. Individual intervention plans on CPOMS. TA timetables and session records filed. Impact reviewed at half-termly SEND review meeting.',
  'Identified students to make measurable progress against individual targets. SEND and Pupil Premium students to access quality first teaching plus targeted support.',
  'End-of-term progress data: 73% of students receiving direct provision made expected or better progress against targets. PP attendance at intervention sessions: 91%.',
  true, true, false, true, true, false, true,
  38, 22, 14, 11, 5,
  '38 students (KS2–KS4)'
FROM public.entries e
JOIN public.provision_points pp ON e.provision_point_id = pp.id
WHERE e.school_id    = '00000000-0000-0000-0000-000000000001'
  AND pp.category    = 'Direct Provision for Students'
  AND NOT EXISTS (
    SELECT 1 FROM public.evidence_entries ee WHERE ee.entry_id = e.id
  );
