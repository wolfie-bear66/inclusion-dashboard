-- Documents changes already applied live (Session 42 audit) — this file is written
-- retroactively for the repo's history; it was not run via this file.
--
-- Live audit (pg_policies) found `entries` and `evidence_entries` each had a set of
-- unconditional "Allow public ..." policies (qual/with_check = true, role {public})
-- sitting alongside already-correct school-scoped policies for the same commands.
-- Since Postgres OR's permissive policies together, the unconditional ones made the
-- scoped ones moot — any authenticated user could read/write any school's rows.
-- No migration file in this repo ever created them; they predate migration tracking.
-- Confirmed via code search: no path in src/ relies on the unconditional versions —
-- every legitimate query was already satisfied by the scoped policy that remains.

DROP POLICY "Allow public insert on entries" ON entries;
DROP POLICY "Allow public read on entries" ON entries;
DROP POLICY "Allow public update on entries" ON entries;

DROP POLICY "Allow public delete on evidence_entries" ON evidence_entries;
DROP POLICY "Allow public insert on evidence_entries" ON evidence_entries;
DROP POLICY "Allow public read on evidence_entries" ON evidence_entries;
DROP POLICY "Allow public update on evidence_entries" ON evidence_entries;

-- schools: INSERT had no scoped sibling at all, but nothing in the client code
-- inserts schools (confirmed via search) — dropped outright, no replacement needed.
DROP POLICY "Allow public insert on schools" ON schools;

-- Deliberately excluded from this cleanup at the time: schools SELECT (no scoped
-- sibling existed yet — see step14_schools_select_policy.sql), the profiles INSERT
-- policy's self-referential WITH CHECK tautology (separate bug, still unfixed), and
-- the harmless redundant-with-each-other read policies on domains/provision_points/
-- sub_domains (reference data, no writes exposed, not a vulnerability).
