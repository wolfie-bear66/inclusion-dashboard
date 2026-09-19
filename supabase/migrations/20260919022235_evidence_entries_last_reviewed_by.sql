-- Records who last confirmed a review (date-only confirmation, never status/content).
-- Nullable, no backfill: existing rows simply have no reviewer on record.
-- ON DELETE SET NULL: if the reviewer's profile is later deleted, the evidence row
-- keeps existing with no reviewer on record, rather than blocking the delete.
ALTER TABLE evidence_entries ADD COLUMN last_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
