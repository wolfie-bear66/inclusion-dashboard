CREATE TABLE IF NOT EXISTS point_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_point_id UUID NOT NULL REFERENCES provision_points(id) ON DELETE CASCADE,
  assignee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provision_point_id, school_id)
);
