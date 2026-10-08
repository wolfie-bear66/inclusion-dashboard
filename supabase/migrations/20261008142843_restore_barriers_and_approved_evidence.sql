-- Restore contributor access to barriers and to evidence on approved points (8 Oct 2026).
--
-- 20261008135853_role_rules_and_demo_lockdown.sql made barriers approver-only and blocked
-- contributor edits of evidence on approved points. The founder does not want either as written:
--   * anyone should be able to ADD a barrier, with an approver confirmation step
--   * a contributor who wants to change an approved point should REQUEST the change
-- Both need purpose-built flows (designed separately). Until those exist, put the previous
-- behaviour back for these two areas. Everything else from that migration stays: the demo
-- account lockdown, the same-school assignment check, approver-only Inclusion Strategy and
-- school context, and the demo checks inside the approval RPCs.

do $$
declare t text; c text;
begin
  foreach t in array array['barriers', 'barrier_provision_points', 'barrier_provision_links'] loop
    foreach c in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'write_requires_approver_' || c, t);
    end loop;
  end loop;
end $$;

drop trigger if exists evidence_entries_protect_approved on public.evidence_entries;
drop function if exists public.evidence_entries_protect_approved();

-- ---------------------------------------------------------------------------------------
-- ROLLBACK (re-applies the approver-only barrier rules and the approved-evidence trigger):
-- re-run the corresponding sections of 20261008135853_role_rules_and_demo_lockdown.sql
-- (section 2 for the three barrier tables only, and section 4).
-- ---------------------------------------------------------------------------------------
