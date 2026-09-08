-- Tracks when a temporary onboarding password was issued to a user, so the
-- app can block login with a stale temp password after 7 days (Phase 1:
-- replacing magic-link invites with temporary-password onboarding).

alter table profiles
  add column if not exists temp_password_issued_at timestamptz;

comment on column profiles.temp_password_issued_at is 'When the current temporary password was issued (onboard-school / invite-user / resend-invite). Null once the user has set their own password. Used to expire unused temp passwords after 7 days.';
