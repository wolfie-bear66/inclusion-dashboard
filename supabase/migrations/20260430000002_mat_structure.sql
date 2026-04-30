-- Migration: MAT structure for Inclusion Dashboard
-- Adds multi-academy trust support with role-based access
-- Date: 2026-04-30

-- 1. Create mats table
CREATE TABLE IF NOT EXISTS mats (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 2. Add mat_id FK to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS mat_id uuid REFERENCES mats(id);

-- 3. Extend profiles with role and mat_id
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role   text DEFAULT 'contributor',
  ADD COLUMN IF NOT EXISTS mat_id uuid REFERENCES mats(id);

-- 4. Insert Demo MAT
INSERT INTO mats (id, name)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Demo MAT')
ON CONFLICT (id) DO NOTHING;

-- 5. Rename Riverdale Academy → Springwell Academy and link to Demo MAT
UPDATE schools
SET name   = 'Springwell Academy',
    mat_id = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 6. Insert Rydell High as the second MAT school
INSERT INTO schools (id, name, mat_id)
VALUES ('00000000-0000-0000-0000-000000000002', 'Rydell High', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
-- Rydell High starts with no entries, no evidence — all provision points will show as blank

-- 7. Assign mat_admin role to the Test School profile
--    This is the profile currently linked to Test School (id: 9c539de8-...)
--    Check your Supabase Auth dashboard to confirm which email this maps to
UPDATE profiles
SET role   = 'mat_admin',
    mat_id = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE id = '9c539de8-0ddf-43d7-974b-e55406966bb3';
