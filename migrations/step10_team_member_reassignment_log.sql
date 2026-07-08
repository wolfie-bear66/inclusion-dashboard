CREATE TABLE IF NOT EXISTS team_member_reassignment_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  removed_first_name        TEXT NOT NULL,
  removed_last_name         TEXT NOT NULL,
  removed_job_title         TEXT,
  replacement_user_id       UUID REFERENCES profiles(id),
  replacement_name          TEXT,
  performed_by              UUID NOT NULL REFERENCES profiles(id),
  points_reassigned_count   INTEGER NOT NULL DEFAULT 0,
  points_unassigned_count   INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_member_reassignment_log ENABLE ROW LEVEL SECURITY;

-- Approvers and mat_admins can read the log for their own school. No client-side
-- INSERT/UPDATE/DELETE policy — this table is only ever written by the
-- remove-team-member Edge Function via the service role, which bypasses RLS.
CREATE POLICY "approvers_read_reassignment_log" ON team_member_reassignment_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('approver', 'mat_admin')
      AND school_id = team_member_reassignment_log.school_id
    )
  );
