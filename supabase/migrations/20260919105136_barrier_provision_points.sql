-- barrier_provision_points: replaces barrier_provision_links as the link between a barrier
-- and the framework provision points it addresses. Old table (entry_id-based, wrong target —
-- an entry only exists once a school has touched a point) is left untouched with its data
-- intact; nothing in the app reads or writes it after this change lands.

CREATE TABLE barrier_provision_points (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barrier_id         uuid NOT NULL REFERENCES barriers(id) ON DELETE CASCADE,
  provision_point_id uuid NOT NULL REFERENCES provision_points(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barrier_id, provision_point_id)
);

ALTER TABLE barrier_provision_points ENABLE ROW LEVEL SECURITY;

-- Own school: select (via the parent barrier's school)
CREATE POLICY "barrier_provision_points_select" ON barrier_provision_points FOR SELECT
USING (
  barrier_id IN (
    SELECT b.id FROM barriers b
    WHERE b.school_id = get_my_school_id()
  )
);

-- MAT-wide read, mirroring barriers_select_mat_admin / evidence_entries_select_mat_admin exactly
CREATE POLICY "barrier_provision_points_select_mat_admin" ON barrier_provision_points FOR SELECT
USING (
  barrier_id IN (
    SELECT b.id FROM barriers b
    JOIN schools s ON s.id = b.school_id
    JOIN profiles p ON p.mat_id = s.mat_id
    WHERE p.id = auth.uid()
  )
);

-- Own school: insert
CREATE POLICY "barrier_provision_points_insert" ON barrier_provision_points FOR INSERT
WITH CHECK (
  barrier_id IN (
    SELECT b.id FROM barriers b
    WHERE b.school_id = get_my_school_id()
  )
);

-- Own school: delete
CREATE POLICY "barrier_provision_points_delete" ON barrier_provision_points FOR DELETE
USING (
  barrier_id IN (
    SELECT b.id FROM barriers b
    WHERE b.school_id = get_my_school_id()
  )
);

-- No update policy, matching barrier_provision_links (links are replaced by delete+insert, never updated).

-- Backfill: one row per existing barrier_provision_links row, resolving entry_id -> provision_point_id.
-- barrier_provision_links and its data are left exactly as they are.
INSERT INTO barrier_provision_points (barrier_id, provision_point_id)
SELECT bpl.barrier_id, e.provision_point_id
FROM barrier_provision_links bpl
JOIN entries e ON e.id = bpl.entry_id
ON CONFLICT (barrier_id, provision_point_id) DO NOTHING;
