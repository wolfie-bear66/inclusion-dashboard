-- profiles.password_set was nullable at the schema level despite every write path
-- (invite-user, onboard-school, SetPasswordPage) relying on its DEFAULT false and never
-- writing an explicit NULL. Live check (Session 63 diagnostic) confirmed 0 NULL rows
-- exist today, but the column stayed nullable, and one comparison in App.jsx
-- (`data.password_set === false`) would silently fail open — skipping the mandatory
-- password-set redirect — if a NULL ever landed there (e.g. a future manual/direct SQL
-- profile insert that didn't go through the app's own invite functions).
--
-- Backfill first (belt-and-suspenders — no row is expected to match, confirmed live),
-- then enforce NOT NULL so this can't silently regress.
UPDATE public.profiles SET password_set = false WHERE password_set IS NULL;

ALTER TABLE public.profiles ALTER COLUMN password_set SET NOT NULL;
