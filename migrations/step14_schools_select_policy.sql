-- Documents changes already applied live (Session 42) — written retroactively for
-- the repo's history; it was not run via this file.
--
-- Replaces schools' two unconditional SELECT policies ("Allow public read on schools",
-- "authenticated read") left out of step13_rls_cleanup_phase1.sql on purpose, since
-- dropping them with no replacement would have broken: the founder's /admin view
-- (AdminView.jsx, cross-MAT read of every school), the MAT dashboard's per-MAT
-- schools list (MATDashboard.jsx, previously scoped client-side only), and the
-- school name shown in every user's header (App.jsx profile-load query's embedded
-- schools(name) join).
--
-- No separate founder/superadmin role existed anywhere in profiles. The founder's
-- account (AdminView.jsx's hardcoded FOUNDER_UUID) turned out to be an ordinary
-- mat_admin profile scoped to Demo MAT (see supabase/migrations/20260430000002_
-- mat_structure.sql) — indistinguishable from any other mat_admin by role or mat_id,
-- so a generic "mat_admin reads their own MAT" policy could not cover the founder's
-- actual cross-MAT requirement. Chose a real is_founder boolean column over embedding
-- the literal UUID directly in policy source (the alternative considered and rejected).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT false;
UPDATE profiles SET is_founder = true WHERE id = '9c539de8-0ddf-43d7-974b-e55406966bb3';

DROP POLICY "Allow public read on schools" ON schools;
DROP POLICY "authenticated read" ON schools;

CREATE POLICY "schools_select_scoped" ON schools
  FOR SELECT USING (
    -- 1. Any user can read their own school
    id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
    OR
    -- 2. A mat_admin can read every school in their own MAT
    (
      mat_id IS NOT NULL
      AND mat_id = (SELECT profiles.mat_id FROM profiles WHERE profiles.id = auth.uid())
    )
    OR
    -- 3. The founder can read every school, cross-MAT, for the /admin view
    (SELECT profiles.is_founder FROM profiles WHERE profiles.id = auth.uid()) = true
  );
