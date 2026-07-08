ALTER TABLE entries
  ADD COLUMN submitted_for_approval_at TIMESTAMPTZ,
  ADD COLUMN send_back_note TEXT;

CREATE TABLE point_approval_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('submitted','confirmed','sent_back')),
  actioned_by   UUID NOT NULL REFERENCES profiles(id),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE point_approval_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated member of a school can read that school's approval log.
CREATE POLICY "school members read approval log" ON point_approval_log
  FOR SELECT USING (
    school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Any authenticated member can insert a log row for their own school only.
-- No UPDATE/DELETE policy — this table is append-only.
CREATE POLICY "school members insert approval log" ON point_approval_log
  FOR INSERT WITH CHECK (
    school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
  );
