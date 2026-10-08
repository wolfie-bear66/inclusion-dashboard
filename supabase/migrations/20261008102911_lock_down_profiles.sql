-- Lock down public.profiles (security review, 8 Oct 2026)
--
-- Problem: anon and authenticated held ALL table privileges on profiles, and the only UPDATE
-- policy was `auth.uid() = id` with no column restriction. Any signed-in user could therefore
-- rewrite their own school_id / role / mat_id / is_founder, and every school-separation policy
-- and the founder-only edge functions trust those columns. The INSERT policy's WITH CHECK
-- compared profiles_1.school_id to itself (always true).
--
-- The client only ever writes: welcomed, onboarding_state, job_title, password_set (own row).
-- Profile creation, role changes, temp_password_issued_at and deletion are all done by edge
-- functions using the service role, which is unaffected by these changes.
--
-- Scope: public.profiles, plus EXECUTE/search_path on five functions. No other table's
-- policies are touched.

-- 1. Table level. Column-level grants only narrow things once table-level UPDATE is gone.
REVOKE ALL ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM authenticated;
-- authenticated keeps table-level SELECT; service_role keeps everything.

-- 2. Column-level UPDATE: only what the client genuinely writes.
--    Deliberately NOT granted: id, school_id, mat_id, role, is_founder,
--    temp_password_issued_at, first_name, last_name.
GRANT UPDATE (job_title, onboarding_state, welcomed, password_set)
  ON public.profiles TO authenticated;

-- 3. The client never inserts profiles (onboard-school / invite-user use the service role).
DROP POLICY IF EXISTS "approvers can insert profiles for their school" ON public.profiles;

-- 4. Function EXECUTE. These carry a PUBLIC grant as well as anon, so both must go.
REVOKE EXECUTE ON FUNCTION public.get_my_school_id()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_entry_approval(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_school_id()                 TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.confirm_entry_approval(uuid, uuid) TO authenticated, service_role;

-- 5. Pin search_path (function bodies are unchanged).
ALTER FUNCTION public.get_my_school_id()                            SET search_path = public;
ALTER FUNCTION public.update_updated_at()                           SET search_path = public;
ALTER FUNCTION public.update_barriers_updated_at()                  SET search_path = public;
ALTER FUNCTION public.update_inclusion_strategy_drafts_updated_at() SET search_path = public;

-- 6. Guard trigger (defence in depth). The grants above are the primary control; this stops
--    the same hole reopening if UPDATE is ever re-granted on the table or a column by mistake
--    (e.g. a dashboard click or a later migration). It only constrains the API roles. The
--    service role (edge functions) and postgres (SQL editor / migrations) are not affected,
--    because current_user is the PostgREST-switched role, not the JWT.
CREATE OR REPLACE FUNCTION public.profiles_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id                      IS DISTINCT FROM OLD.id
    OR NEW.school_id               IS DISTINCT FROM OLD.school_id
    OR NEW.mat_id                  IS DISTINCT FROM OLD.mat_id
    OR NEW.role                    IS DISTINCT FROM OLD.role
    OR NEW.is_founder              IS DISTINCT FROM OLD.is_founder
    OR NEW.temp_password_issued_at IS DISTINCT FROM OLD.temp_password_issued_at
    OR NEW.first_name              IS DISTINCT FROM OLD.first_name
    OR NEW.last_name               IS DISTINCT FROM OLD.last_name
    THEN
      RAISE EXCEPTION 'profiles: protected columns cannot be changed by this role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_protect_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_columns();

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed; restores the pre-migration state)
--
-- DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
-- DROP FUNCTION IF EXISTS public.profiles_protect_columns();
-- GRANT ALL ON public.profiles TO anon, authenticated;
-- CREATE POLICY "approvers can insert profiles for their school" ON public.profiles
--   FOR INSERT TO public
--   WITH CHECK (EXISTS (
--     SELECT 1 FROM profiles profiles_1
--     WHERE profiles_1.id = auth.uid()
--       AND profiles_1.role = ANY (ARRAY['approver'::text, 'mat_admin'::text])
--       AND profiles_1.school_id = profiles_1.school_id));
-- GRANT EXECUTE ON FUNCTION public.get_my_school_id()                 TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.confirm_entry_approval(uuid, uuid) TO PUBLIC, anon;
-- ALTER FUNCTION public.get_my_school_id()                            RESET search_path;
-- ALTER FUNCTION public.update_updated_at()                           RESET search_path;
-- ALTER FUNCTION public.update_barriers_updated_at()                  RESET search_path;
-- ALTER FUNCTION public.update_inclusion_strategy_drafts_updated_at() RESET search_path;
-- ---------------------------------------------------------------------------------------
