-- Recent activity feed: logging must never block a save (19 Oct 2026).
--
-- Follow-up to 20261019152509_activity_log.sql (applied, not edited). The three logging triggers
-- now wrap their work in EXCEPTION WHEN OTHERS: on any error they RAISE WARNING with SQLSTATE and
-- SQLERRM, then return normally, so the evidence or status write that fired them still succeeds.
-- A failed log insert is rolled back to the block's own savepoint; the user's write is not.
-- (The log line is lost in that case, which is the intended trade: the feed is never worth a lost save.)
--
-- Also: evidence inserted with a NULL provision_name is treated as a setup-wizard write and always
-- logs evidence_added, never evidence_first. The evidence modal always sends a title (it pre-fills the
-- point's label), BootstrapWizard's policy-link insert sends only entry_id + supporting_document_link.
-- Heuristic, no schema change. Side effect: a wizard evidence line counts as an "earlier" line, so an
-- approver whose wizard run included a policy link will not later get an evidence_first line.
--
-- SECURITY DEFINER, search_path and the revoked execute grants are unchanged (re-stated below,
-- harmless). activity_actor_name is untouched.

create or replace function public.log_evidence_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_school    uuid;
  v_label     text;
  v_principle text;
  v_event     text := 'evidence_added';
begin
  begin
    v_uid := auth.uid();

    select e.school_id, pp.label, pp.principle
      into v_school, v_label, v_principle
    from public.entries e
    join public.provision_points pp on pp.id = e.provision_point_id
    where e.id = NEW.entry_id;

    if v_school is not null then
      -- NULL title = setup wizard write: never "first".
      if v_uid is not null and NEW.provision_name is not null and not exists (
        select 1 from public.activity_log
        where actor_id = v_uid and event_type in ('evidence_added', 'evidence_first')
      ) then
        v_event := 'evidence_first';
      end if;

      insert into public.activity_log
        (school_id, actor_id, actor_name, event_type, entry_id, entry_label, principle, evidence_id, evidence_title)
      values
        (v_school, v_uid, public.activity_actor_name(v_uid), v_event, NEW.entry_id, v_label, v_principle,
         NEW.id, coalesce(nullif(btrim(NEW.provision_name), ''), v_label));
    end if;
  exception when others then
    raise warning 'activity_log: log_evidence_added failed (SQLSTATE %): %', sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_label     text;
  v_principle text;
begin
  begin
    if NEW.status is not null
       and not (TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status) then
      v_uid := auth.uid();

      select pp.label, pp.principle into v_label, v_principle
      from public.provision_points pp where pp.id = NEW.provision_point_id;

      insert into public.activity_log
        (school_id, actor_id, actor_name, event_type, entry_id, entry_label, principle, status_from, status_to)
      values
        (NEW.school_id, v_uid, public.activity_actor_name(v_uid), 'status_changed', NEW.id, v_label, v_principle,
         case when TG_OP = 'UPDATE' then OLD.status else null end, NEW.status);
    end if;
  exception when others then
    raise warning 'activity_log: log_status_change failed (SQLSTATE %): %', sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.log_evidence_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.activity_log
    set removed = true,
        evidence_title = 'Evidence Removed',
        evidence_id = null
    where evidence_id = OLD.id;
  exception when others then
    raise warning 'activity_log: log_evidence_removed failed (SQLSTATE %): %', sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.log_evidence_added()   from public, anon, authenticated;
revoke execute on function public.log_status_change()    from public, anon, authenticated;
revoke execute on function public.log_evidence_removed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK: re-run the three function definitions from 20261019152509_activity_log.sql.
-- ---------------------------------------------------------------------------------------
