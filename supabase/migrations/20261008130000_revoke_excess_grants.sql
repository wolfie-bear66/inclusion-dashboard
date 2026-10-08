-- Remove grants and function access the app never uses (security audit follow-up, 8 Oct 2026)
--
-- Context: Supabase default privileges gave anon and authenticated ALL privileges on every table
-- in public. RLS is enabled on all of them and is what actually protects the data, but the
-- extra grants widen the blast radius if RLS is ever disabled or bypassed (TRUNCATE ignores
-- RLS entirely for anyone with a direct database connection). profiles was fixed in
-- 20261008102911_lock_down_profiles.sql; this applies the safe part of the same cleanup to the
-- other tables, plus the two approval RPCs and the trigger functions.
--
-- Deliberately NOT changed: authenticated SELECT/INSERT/UPDATE/DELETE on any table (the app
-- relies on them, with RLS as the gate), RLS policies, service_role, or default privileges for
-- future tables.
--
-- Fix A: table grants

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    -- PostgREST never issues these; nothing in the app can need them.
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', t.tablename);

    IF t.tablename IN ('domains', 'sub_domains', 'provision_points') THEN
      -- Reference data that is intentionally readable when signed out; keep anon SELECT only.
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t.tablename);
    ELSE
      -- No signed-out page reads or writes these tables.
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tablename);
    END IF;
  END LOOP;
END $$;

-- Fix B: function EXECUTE
-- Approval RPCs: signed-in users only. (Each also checks the caller's identity and role.)
REVOKE EXECUTE ON FUNCTION public.submit_entry_for_approval(uuid, uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_back_entry_approval(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_entry_for_approval(uuid, uuid)      TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.send_back_entry_approval(uuid, uuid, text) TO authenticated, service_role;

-- Trigger functions are never called directly; firing a trigger does not need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_barriers_updated_at()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_inclusion_strategy_drafts_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (run manually if needed; restores the pre-migration state)
--
-- DO $$
-- DECLARE t record;
-- BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'profiles' LOOP
--     EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t.tablename);
--   END LOOP;
-- END $$;
-- GRANT EXECUTE ON FUNCTION public.submit_entry_for_approval(uuid, uuid)           TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.send_back_entry_approval(uuid, uuid, text)      TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.update_updated_at()                             TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_barriers_updated_at()                    TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_inclusion_strategy_drafts_updated_at()   TO PUBLIC, anon, authenticated;
-- (profiles is excluded from the rollback on purpose: its grants are managed by the earlier migration.)
-- ---------------------------------------------------------------------------------------
