-- Additive RLS for contributor self-assign (Step 6, Session 41). Existing
-- approvers_insert_assignments / approvers_delete_assignments policies
-- (migrations/step3_rls_policies.sql) are untouched — approver/mat_admin can still
-- assign/reassign anyone. These new policies only ever let a user act on their own
-- assignee_user_id, within their own school.

CREATE POLICY "self_assign_insert" ON point_assignments
  FOR INSERT WITH CHECK (
    assignee_user_id = auth.uid()
    AND school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "self_unassign_delete" ON point_assignments
  FOR DELETE USING (
    assignee_user_id = auth.uid()
    AND school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
  );
