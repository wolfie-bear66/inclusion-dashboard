-- Records who last confirmed a review (date-only confirmation, never status/content).
-- Nullable, no backfill: existing rows simply have no reviewer on record.
ALTER TABLE evidence_entries ADD COLUMN last_reviewed_by uuid REFERENCES profiles(id);
