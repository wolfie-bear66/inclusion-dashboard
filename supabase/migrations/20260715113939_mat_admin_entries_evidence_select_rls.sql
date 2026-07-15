-- Fixes the MAT Dashboard entries-RLS bug logged in TASKS.md (Session 47, diagnosed further
-- Session 49): mat_admin accounts could only read `entries`/`evidence_entries` for their own
-- school, not other schools in their MAT, so the live MAT Dashboard showed 0% for every school
-- except the caller's own (School pills, Domains, Categories, Schools table, Provision Depth,
-- Trust Trajectory, and Reviews due all derive from these two tables — see Session 49 diagnostic).
--
-- Additive SELECT-only policies, mirroring the existing `barriers_select_mat_admin` pattern
-- exactly (schools.mat_id = profiles.mat_id via the caller's own profile). Existing own-school
-- policies on both tables are untouched; these are extra permissive policies that OR in for
-- SELECT only. mat_admin write access to other schools remains unchanged (still not permitted).

CREATE POLICY "entries_select_mat_admin" ON entries FOR SELECT
USING (
  school_id IN (
    SELECT s.id FROM schools s
    JOIN profiles p ON p.mat_id = s.mat_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "evidence_entries_select_mat_admin" ON evidence_entries FOR SELECT
USING (
  entry_id IN (
    SELECT e.id FROM entries e
    JOIN schools s ON s.id = e.school_id
    JOIN profiles p ON p.mat_id = s.mat_id
    WHERE p.id = auth.uid()
  )
);
