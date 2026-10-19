-- Recent activity feed: credit the person who did the work, not the approver (19 Oct 2026).
--
-- Follow-up to 20261019152509_activity_log.sql and 20261019153551_activity_log_safe_triggers.sql
-- (both applied, not edited). Only log_status_change is recreated; nothing else changes: no new
-- columns, no UI change, no change to the approval functions.
--
-- Today an approver confirming a contributor's submission, or accepting a contributor's change
-- request, is recorded as the person who changed the status, so the feed credits the approver.
-- Now, when the caller is signed in and the change is one of those two approvals, the line is
-- credited to the contributor (actor_id / actor_name). The approver is NOT shown in the feed (founder
-- decision, option C); the approver is still recorded in point_approval_log ('confirmed',
-- 'change_accepted').
--
--   1. Approving a submission: status moves to in_place on an entry that was waiting for approval
--      (OLD.submitted_for_approval_at is not null) and has a submitter (OLD.submitted_by), and the
--      caller is not that submitter -> credit OLD.submitted_by.
--   2. Accepting a change request: status moves from in_place to in_progress / not_in_place while a
--      pending point_change_requests row asks for exactly that status (decide_point_status_change
--      updates the entry before it closes the request) and the caller is not the requester ->
--      credit the requester.
--
-- Everything else is unchanged: a direct status edit is credited to whoever made it, a send-back
-- (status goes to in_progress, never in_place) is credited to the approver, and a write with no
-- signed-in user (service role, SQL editor) is never re-credited. If the submitter or requester is
-- missing, the line stays credited to the caller. The exception handling is kept: a logging error
-- raises a warning and never blocks the save. SECURITY DEFINER, search_path and revoked execute
-- grants are unchanged.

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_actor     uuid;
  v_label     text;
  v_principle text;
  v_requester uuid;
begin
  begin
    if NEW.status is not null
       and not (TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status) then
      v_uid := auth.uid();
      v_actor := v_uid;

      if TG_OP = 'UPDATE' and v_uid is not null then
        if NEW.status = 'in_place'
           and OLD.submitted_for_approval_at is not null
           and OLD.submitted_by is not null
           and OLD.submitted_by is distinct from v_uid then
          v_actor := OLD.submitted_by;
        elsif OLD.status = 'in_place' and NEW.status in ('in_progress', 'not_in_place') then
          select r.requested_by into v_requester
          from public.point_change_requests r
          where r.entry_id = NEW.id and r.status = 'pending' and r.requested_status = NEW.status
          limit 1;
          if v_requester is not null and v_requester is distinct from v_uid then
            v_actor := v_requester;
          end if;
        end if;
      end if;

      select pp.label, pp.principle into v_label, v_principle
      from public.provision_points pp where pp.id = NEW.provision_point_id;

      insert into public.activity_log
        (school_id, actor_id, actor_name, event_type, entry_id, entry_label, principle, status_from, status_to)
      values
        (NEW.school_id, v_actor, public.activity_actor_name(v_actor), 'status_changed', NEW.id, v_label, v_principle,
         case when TG_OP = 'UPDATE' then OLD.status else null end, NEW.status);
    end if;
  exception when others then
    raise warning 'activity_log: log_status_change failed (SQLSTATE %): %', sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.log_status_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- ROLLBACK: re-run the log_status_change definition from 20261019153551_activity_log_safe_triggers.sql.
-- ---------------------------------------------------------------------------------------
