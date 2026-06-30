# Schema Reference

Supabase project: `zgolrthcrupvrrvfokvz`

---

## profiles

| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users.id |
| school_id | uuid | FK → schools.id |
| mat_id | uuid | FK → mats.id. Null for non-MAT users |
| role | text | System role: `contributor`, `approver`, `mat_admin` |
| first_name | text | |
| last_name | text | |
| job_title | text | School role e.g. SENCO, Assistant Head. Distinct from system `role` column. Null for older profiles. |
| onboarding_state | jsonb | `{ self_assign_entered, has_team_members, team_prompt_dismissed, second_login_or_later }` |
| welcomed | boolean | Set true once contributor welcome banner is dismissed |

---

## point_assignments

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| provision_point_id | uuid | FK → provision_points.id |
| assignee_user_id | uuid | FK → profiles.id |
| school_id | uuid | FK → schools.id |
| assigned_by | uuid | FK → profiles.id (the approver who made the assignment) |
| created_at | timestamptz | |

Unique constraint: `(provision_point_id, school_id)` — one owner per point per school.

---

## provision_points

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| label | text | Display name of the provision point |
| category | text | One of 8 categories (Named Person, Policy / Published Document, …) |
| sub_domain_id | uuid | FK → sub_domains.id |
| active | boolean | Inactive points are excluded from all views |
| display_order | integer | |

---

## entries

One row per `(school_id, provision_point_id)` pair. Records the current compliance status for a provision point at a school.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| school_id | uuid | FK → schools.id |
| provision_point_id | uuid | FK → provision_points.id |
| status | text | **Only valid values: `in_place`, `in_progress`, `not_in_place`.** The value `complete` does not exist and must never be used. |
| updated_at | timestamptz | |

Unique constraint: `(school_id, provision_point_id)`.

---

## evidence_entries

Child rows of `entries`. Each entry can have multiple evidence records.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| entry_id | uuid | FK → entries.id |
| provision_name | text | Display label for this piece of evidence |
| next_review_due | date | Used for reviews-due panels |

---

## migrations applied

| File | Description |
|---|---|
| step1_onboarding_state.sql | Adds `onboarding_state` JSONB column to profiles |
| step2_point_assignments.sql | Creates `point_assignments` table |
| step3_rls_policies.sql | RLS policies on `point_assignments` |
| step6a_onboarding_v2.sql | Adds `second_login_or_later` to `onboarding_state` default |
| step6b_welcomed.sql | Adds `welcomed` boolean column to profiles |
| step7_job_title.sql | Adds `job_title` text column to profiles |
| step8_school_phase.sql | Adds `phase` text column to schools (CHECK: primary / secondary / all_through / special) |

---

## barriers

| column | type | notes |
|--------|------|-------|
| id | uuid | PK |
| school_id | uuid | FK → schools.id |
| domain_id | uuid | FK → domains.id — NOT a text field, always a UUID |
| sub_domain_id | uuid | FK → sub_domains.id — nullable |
| description | text | |
| student_groups | jsonb | Array format: `'["SEND","PP"]'::jsonb` — NOT a text array |
| scale | text | CHECK: `individual` / `group` / `whole_school` |
| source | text | CHECK: `data_analysis` / `staff_observation` / `pupil_voice` / `family_feedback` / `external_review` |
| status | text | CHECK: `active` / `being_addressed` / `resolved` |
| actions | text | nullable — what was done to address the barrier |
| date_identified | date | nullable |
| next_review_due | date | nullable |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

**Critical:** `domain_id` and `sub_domain_id` are UUIDs — never pass domain name strings. Always look up or hardcode UUIDs from the domains/sub_domains tables.

**Domain UUIDs (verified 28 June 2026):**
- SEND Support & Needs: `11111111-0000-0000-0000-000000000001`
- Equity & Disadvantage: `11111111-0000-0000-0000-000000000002`
- Attendance & Engagement: `11111111-0000-0000-0000-000000000003`
- Enrichment: `11111111-0000-0000-0000-000000000004`
- Belonging: `11111111-0000-0000-0000-000000000005`
- Wellbeing: `11111111-0000-0000-0000-000000000006`

**Sub-domain UUIDs (verified 28 June 2026):**

| Sub-domain | UUID |
|------------|------|
| SEND — Identification & Assessment | `22222222-0001-0000-0000-000000000001` |
| SEND — Teaching & Learning | `22222222-0002-0000-0000-000000000001` |
| SEND — Intervention & Support | `22222222-0003-0000-0000-000000000001` |
| SEND — Specialist Provision | `22222222-0004-0000-0000-000000000001` |
| Equity — Identification & Understanding | `22222222-0001-0000-0000-000000000002` |
| Equity — Academic Support | `22222222-0002-0000-0000-000000000002` |
| Equity — Pastoral Support | `22222222-0003-0000-0000-000000000002` |
| Attendance — Intervention & Support | `22222222-0001-0000-0000-000000000003` |
| Attendance — Culture & Systems | `22222222-0002-0000-0000-000000000003` |
| Attendance — Complex Non-attendance | `22222222-0003-0000-0000-000000000003` |
| Attendance — Behaviour Support | `22222222-0004-0000-0000-000000000003` |
| Enrichment — Civic Engagement | `22222222-0001-0000-0000-000000000004` |
| Enrichment — Arts & Culture | `22222222-0002-0000-0000-000000000004` |
| Enrichment — Nature & Outdoors | `22222222-0003-0000-0000-000000000004` |
| Enrichment — Sport | `22222222-0004-0000-0000-000000000004` |
| Enrichment — Wider Life Skills | `22222222-0005-0000-0000-000000000004` |
| Belonging — Relational Safety | `22222222-0001-0000-0000-000000000005` |
| Belonging — Peer Relationships | `22222222-0002-0000-0000-000000000005` |
| Belonging — Identity & Inclusion | `22222222-0003-0000-0000-000000000005` |
| Belonging — Pupil Voice & Agency | `22222222-0004-0000-0000-000000000005` |
| Belonging — Family & Community | `22222222-0005-0000-0000-000000000005` |
| Wellbeing — Mental Health Support | `22222222-0001-0000-0000-000000000006` |
| Wellbeing — SEL Curriculum | `22222222-0002-0000-0000-000000000006` |
| Wellbeing — Ethos & Climate | `22222222-0003-0000-0000-000000000006` |
| Wellbeing — Behaviour as Communication | `22222222-0004-0000-0000-000000000006` |

---

## barrier_provision_links

| column | type | notes |
|--------|------|-------|
| id | uuid | PK |
| barrier_id | uuid | FK → barriers.id |
| entry_id | uuid | FK → entries.id |

**Join path to provision point:** `barrier_provision_links.entry_id` → `entries.id` → `entries.provision_point_id` → `provision_points.id`

**Join path to school:** `barrier_provision_links.entry_id` → `entries.school_id`

**Seed SQL pattern:**
```sql
INSERT INTO public.barrier_provision_links (barrier_id, entry_id)
VALUES ('', '')
ON CONFLICT DO NOTHING;
```

**Note:** Rydell High barrier "No designated named person for LAC" has no provision link — no matching provision point label exists in the framework. Barrier is intentionally unlinked. Do not attempt to fix this.
