-- rydell_high_v2.sql
-- Seeds all provision points for Rydell High as a non-compliant school.
-- School ID: e0a1ae72-3a42-4145-b2a2-a741a00556ab
-- Strategy:
--   Named Person & Policy / Published Document  → complete   (core compliance only)
--   Monitoring & Data                           → in_progress
--   Staff Training & CPD                        → in_progress (Enrichment/Belonging/Wellbeing)
--                                                  or not_started elsewhere
--   External Partnership                        → not_started
--   Family & Community Engagement               → not_started
--   Direct Provision for Students               → not_started (most)
--   Enrichment domain                           → not_started (drives red)
--   Belonging domain                            → not_started (drives red)
--   Wellbeing domain                            → not_started (drives red)
--
-- Uses ON CONFLICT (school_id, provision_point_id) DO NOTHING to preserve
-- the 3 existing Rydell entries.

DO $$
DECLARE
  v_school_id uuid := 'e0a1ae72-3a42-4145-b2a2-a741a00556ab';
BEGIN

-- ─────────────────────────────────────────────────────────────────
-- 1. Named Person & Policy / Published Document → complete
--    These represent basic compliance Rydell has technically done.
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  'complete'
FROM public.provision_points pp
WHERE pp.category IN ('Named Person', 'Policy / Published Document')
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 2. Monitoring & Data → in_progress
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  'in_progress'
FROM public.provision_points pp
WHERE pp.category = 'Monitoring & Data'
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 3. Staff Training & CPD
--    SEND domain → in_progress (some awareness training exists)
--    All other domains → not_started
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  CASE
    WHEN d.name ILIKE '%SEND%' THEN 'in_progress'
    ELSE 'not_started'
  END
FROM public.provision_points pp
JOIN public.sub_domains sd ON pp.sub_domain_id = sd.id
JOIN public.domains d      ON sd.domain_id     = d.id
WHERE pp.category = 'Staff Training & CPD'
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 4. External Partnership → not_started (all domains)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  'not_started'
FROM public.provision_points pp
WHERE pp.category = 'External Partnership'
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 5. Family & Community Engagement → not_started
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  'not_started'
FROM public.provision_points pp
WHERE pp.category = 'Family & Community Engagement'
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 6. Direct Provision for Students
--    SEND domain → in_progress (some provision exists, poorly documented)
--    Attendance domain → in_progress
--    Enrichment, Belonging, Wellbeing, Equity → not_started
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.entries (school_id, provision_point_id, status)
SELECT
  v_school_id,
  pp.id,
  CASE
    WHEN d.name ILIKE '%SEND%'       THEN 'in_progress'
    WHEN d.name ILIKE '%Attendance%' THEN 'in_progress'
    ELSE 'not_started'
  END
FROM public.provision_points pp
JOIN public.sub_domains sd ON pp.sub_domain_id = sd.id
JOIN public.domains d      ON sd.domain_id     = d.id
WHERE pp.category = 'Direct Provision for Students'
ON CONFLICT (school_id, provision_point_id) DO NOTHING;

END $$;
