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
