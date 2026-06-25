ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_state JSONB DEFAULT '{
  "self_assign_entered": false,
  "has_team_members": false,
  "team_prompt_dismissed": false
}'::jsonb;
