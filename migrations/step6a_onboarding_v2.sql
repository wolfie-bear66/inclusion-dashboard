ALTER TABLE profiles
ALTER COLUMN onboarding_state
SET DEFAULT '{
  "self_assign_entered": false,
  "has_team_members": false,
  "team_prompt_dismissed": false,
  "second_login_or_later": false
}'::jsonb;
