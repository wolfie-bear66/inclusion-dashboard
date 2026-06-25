ALTER TABLE point_assignments ENABLE ROW LEVEL SECURITY;

-- Approvers and mat_admins can read all assignments for their school
CREATE POLICY "approvers_read_assignments" ON point_assignments
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Approvers and mat_admins can insert assignments
CREATE POLICY "approvers_insert_assignments" ON point_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('approver', 'mat_admin')
      AND school_id = point_assignments.school_id
    )
  );

-- Approvers and mat_admins can delete (reassign) assignments
CREATE POLICY "approvers_delete_assignments" ON point_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('approver', 'mat_admin')
      AND school_id = point_assignments.school_id
    )
  );
