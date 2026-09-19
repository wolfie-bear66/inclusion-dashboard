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

## schools

Not previously documented here — columns below confirmed by Stuart from his actual manual
onboarding SQL, 27 August 2026. Full column list not live-verified; there may be others.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | Required |
| urn | text | Nullable. School's DfE reference number |
| mat_name | text | Nullable. Null for standalone schools. Denormalised alongside `mat_id` — kept in sync manually, not derived |
| mat_id | uuid | Nullable, FK → mats.id |
| phase | text | CHECK: `primary` / `secondary` / `all_through` / `special` (`step8_school_phase.sql`) |
| created_at | timestamptz | Default, never set manually |

No RLS policy currently permits client-side INSERT on this table (the only one that existed
was dropped in Session 42's cleanup with no replacement, since nothing inserted schools
client-side at the time — see `migrations/step13_rls_cleanup_phase1.sql`). Any new
school-creation path must go through a service-role Edge Function.

---

## mats

Live-verified via `information_schema.columns`, 27 August 2026 — exactly these 3 columns,
no other constraints beyond `id`/`name` being `NOT NULL`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | Required |
| created_at | timestamptz | Nullable, default `now()` |

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
| submitted_for_approval_at | timestamptz | Nullable. **Pending approval means this is set.** Cleared by `confirm_entry_approval`/`send_back_entry_approval`; set by `submit_entry_for_approval` |
| submitted_by | uuid | FK → profiles.id, `ON DELETE NO ACTION`. Nullable. The contributor who last submitted this entry |
| send_back_note | text | Nullable. Set by `send_back_entry_approval`; not cleared on the next submission, so a re-submission after a send-back still shows the old note until overwritten by a later send-back |
| updated_at | timestamptz | |

Unique constraint: `(school_id, provision_point_id)`.

See "Approval workflow" below for the RPCs that write `submitted_for_approval_at`/`submitted_by`/`send_back_note`, and the log/notification tables they write to.

---

## evidence_entries

Child rows of `entries`. Each entry can have multiple evidence records. This table is much
wider than earlier versions of this doc suggested — verified against the live schema
2026-07-04.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| entry_id | uuid | FK → entries.id |
| provision_name | text | Display label for this piece of evidence |
| brief_description | text | |
| delivered_by_role | text | |
| funding_source | text | CHECK: `pupil_premium` / `send_budget` / `inclusive_mainstream_fund` / `sport_premium` / `school_general_budget` / `experts_at_hand`. Plain text + CHECK constraint, **not** a Postgres enum type |
| review_cycle | text | **Legacy.** CHECK: `weekly` / `half_termly` / `termly` / `annual` / `as_needed`. No current save path writes it — the evidence modal strips it on every save (existing values on old rows are left as-is, never nulled). The review sheet and "Coming up for review" both ignore it entirely; the next review date comes only from the review sheet's own interval chips/date picker |
| indicator_type | text | |
| named_role_policy_document | text | |
| owner | text | |
| evidence_notes | text | |
| cost | numeric | |
| notes | text | |
| grp_send / grp_pp / grp_eal / grp_fsm / grp_lac / grp_wwc / grp_social_care / grp_young_carer / grp_mental_health_support / grp_other | boolean | Default `false` each |
| created_at | timestamptz | Default `now()` |
| who_delivers | text | |
| send_tiers | text[] | Default `'{}'` |
| delivered_by | text | |
| pupils_reached | integer | Legacy generic field, used when `provision_category` is unset. Distinct from `structured_detail.pupils_reached` on expert-engagement rows |
| date_started | date | |
| date_last_reviewed | date | Set by the evidence modal on any save, and by the review sheet's "Still current" action (via `handleConfirmReview`) |
| next_review_due | date | Used for "Coming up for review" (60-day window). Set by the evidence modal on any save, and by the review sheet's "Still current" action. A date-only review confirmation from the review sheet deliberately does **not** go through approval — it only ever writes `date_last_reviewed`/`next_review_due`/`last_reviewed_by`, never `status`, and never calls `submit_entry_for_approval` |
| impact_on_outcomes | text | |
| supporting_document_link | text | |
| intended_outcomes | text | |
| provision_category | text | `student_facing` / `policy_structural` / `whole_school`, or empty string for legacy entries. Drives which fields the evidence modal shows |
| reach_total / reach_send / reach_pp / reach_eal / reach_fsm / reach_lac / reach_wwc / reach_social_care / reach_young_carer / reach_mental_health_support / reach_other | integer | Structured reach breakdown, used when `provision_category` is set. No default, nullable |
| updated_at | timestamptz | Default `now()` |
| evidence_type | text | NOT NULL, default `'standard'`. CHECK: `standard` / `expert_engagement` |
| structured_detail | jsonb | Nullable. Populated only when `evidence_type = 'expert_engagement'` (currently just the "Experts at Hand service accessed and used" provision point, id `f8509db3-b3d7-44a8-a061-b6f8a05848f1`). Shape: `{ professional_type, commissioning_route, activity_type, pupils_reached, report_received }` |
| last_reviewed_by | uuid | Nullable. FK → profiles.id, `ON DELETE SET NULL`. Written only by the review sheet's "Still current" action; deliberately excluded from the full evidence modal's save (stripped in `handleModalSave`'s Step 2 destructure alongside `status`/`review_cycle`, so it can't be round-tripped even if this column is ever added to the modal's fetch query) |

Note: `entries` also has its own `funding_source` column with an identical CHECK constraint,
but it is never read or written by the app — `evidence_entries.funding_source` is the one
actually used.

Note: `entries` also has its own `grp_send`/`grp_pp`/.../`grp_other` boolean columns
(the original 7 groups only — never extended to the 3 added Session 46). These are
fetched by the app in a couple of places but never read back or written to from any
current code path — confirmed dead/legacy. All live group-tag logic reads
`evidence_entries.grp_*` instead. Do not extend `entries.grp_*` without first confirming
whether anything has started relying on it.

---

## school_context

One row per school (`UNIQUE` on `school_id`), holds pupil cohort sizes. Its original purpose
was the denominator for % reach in Group Reach analytics, but that Analytics section was
removed (Session 79). **Verified by grep (2026-09-20): the only live consumers now are**
`SchoolContextPanel` (edit path — rendered in exactly one place, the "School Cohort Profile"
card inside Report Builder) and `generateReport.js`/`generateReportWord.js` (read path — the
School Context section display and the Funding & Cost section's per-pupil figures). A
`GroupReach` component in `App.jsx` still reads this data but is defined and never rendered
anywhere — dead code, not a live consumer. Not previously documented here — verified against
the live schema 2026-07-15.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| school_id | uuid | FK → schools.id, unique |
| total_pupils | integer | NOT NULL, default `0` |
| pp_count / send_count / fsm_count / eal_count / lac_count / wwc_count | integer | NOT NULL, default `0` each |
| social_care_count / young_carer_count / mental_health_support_count | integer | NOT NULL, default `0` each. Added Session 46, alongside the matching `evidence_entries` grp_*/reach_* columns above |
| updated_at | timestamptz | |

No `other_count` column exists — there has never been an "Other" cohort size field here.

---

## my_points_queue_state

Per-user, per-school, per-point queue state for the "My Points" onboarding queue (contributor
role). Not previously documented here — live-verified 2026-09-20.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | NOT NULL. FK → profiles.id, `ON DELETE CASCADE` |
| provision_point_id | uuid | NOT NULL. FK → provision_points.id, `ON DELETE NO ACTION` |
| school_id | uuid | NOT NULL. FK → schools.id, `ON DELETE CASCADE` |
| skip_count | integer | NOT NULL, default `0` |
| acknowledged_at | timestamptz | Nullable. **No longer written by the app as of Session 81** — it was the old Named Person "This is mine — confirm" flow's only write, removed when Named Person was unified with the standard role-based approval fork. The column and any pre-existing values are left in place; `skip_count >= 3` or a non-null `acknowledged_at` still permanently excludes a point from the queue if either is already set |
| created_at | timestamptz | NOT NULL, default `now()` |
| updated_at | timestamptz | NOT NULL, default `now()` |

Unique constraint: `(user_id, school_id, provision_point_id)`.

---

## Status counting definitions

`src/utils/computeCounts.js` is the one shared helper for turning `entries.status` into
counts, over active provision points only. Four buckets, always non-overlapping and always
summing to the total: **in place** (`status = 'in_place'`), **in progress**
(`status = 'in_progress'`), **not in place** (`status = 'not_in_place'`, explicit only), and
**not started** (no `entries` row at all — not the same as an explicit `not_in_place`).

Verified by grep (2026-09-20):

- **Use `computeCounts()`**: the homepage header/readiness card, the sidebar's "N of 166
  recorded" figure, the homepage ledger (Principles/Domains/Categories rows), and
  `DrillDownDetail` (the shared Category/Principle drill-down page).
- **Still use their own, independent formula** (not `computeCounts()`): `usePrincipleCoverage`
  (the hook now only feeding `BootstrapWizard.jsx`'s and `MyPointsQueue.jsx`'s own principle
  progress bars — the homepage stopped using its `principleData` when the ledger replaced the
  principle cards); the standalone Categories index page and the standalone Domains index page
  (both reached via the sidebar, `App.jsx`); the standalone Domain detail page's per-sub-domain
  counts (which track in place/in progress/untouched only — no explicit not-in-place bucket at
  all); `MATDashboard.jsx`'s own inline reduces; and `generateReport.js`'s `getReadinessData`
  (shared by both the PDF and Word report generators).

---

## Approval workflow

Three RPCs, called via `supabase.rpc(...)`, plus two supporting tables. Live-verified
2026-09-20 (arguments and column lists only — function bodies not reproduced here).

| Function | Arguments | What it does |
|---|---|---|
| `submit_entry_for_approval` | `p_entry_id uuid, p_submitting_user_id uuid` | Sets `entries.submitted_for_approval_at`/`submitted_by`; logs a `'submitted'` row to `point_approval_log`. Called by a contributor's evidence-modal save when they choose "In Place" |
| `confirm_entry_approval` | `p_entry_id uuid, p_approver_id uuid` | **SECURITY DEFINER.** Sets `entries.status = 'in_place'`, clears `submitted_for_approval_at`; logs a `'confirmed'` row to `point_approval_log`; inserts a row into `approval_notifications` for the original submitter |
| `send_back_entry_approval` | `p_entry_id uuid, p_approver_id uuid, p_note text DEFAULT NULL` | Sets `entries.status = 'in_progress'`, clears `submitted_for_approval_at`, sets `send_back_note`; logs a `'sent_back'` row to `point_approval_log` |

None of these three are involved in the review sheet's date-only "Still current" confirmation —
that writes directly to `evidence_entries` and never calls any of them (a deliberate, recorded
exemption from approval). "Needs updating" (the review sheet's secondary action) opens the full
evidence modal instead, which can call `submit_entry_for_approval` as normal.

### approval_notifications

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | NOT NULL. FK → profiles.id, `ON DELETE CASCADE`. The original submitter being notified |
| entry_id | uuid | NOT NULL. FK → entries.id, `ON DELETE CASCADE` |
| approved_at | timestamptz | NOT NULL, default `now()` |
| seen_at | timestamptz | Nullable. Set once the submitter's next load has shown the notification |

### point_approval_log

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| entry_id | uuid | NOT NULL. FK → entries.id, `ON DELETE CASCADE` |
| school_id | uuid | NOT NULL. FK → schools.id, `ON DELETE CASCADE` |
| action | text | NOT NULL. CHECK: `submitted` / `confirmed` / `sent_back` |
| actioned_by | uuid | NOT NULL. FK → profiles.id, `ON DELETE NO ACTION` |
| note | text | Nullable. Only set on `sent_back` rows |
| created_at | timestamptz | NOT NULL, default `now()` |

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
| step9_expert_engagement_evidence.sql | Adds `evidence_type` + `structured_detail` (jsonb) to evidence_entries; adds `experts_at_hand` to the funding_source CHECK constraint |
| supabase/migrations/20260715094811_add_social_care_young_carer_mh_support.sql | Adds `grp_social_care`/`grp_young_carer`/`grp_mental_health_support` (boolean, default false) and `reach_social_care`/`reach_young_carer`/`reach_mental_health_support` (integer, nullable) to `evidence_entries`; adds `social_care_count`/`young_carer_count`/`mental_health_support_count` (integer, default 0) to `school_context` |
| supabase/migrations/20260919022235_evidence_entries_last_reviewed_by.sql | Adds `last_reviewed_by` (uuid, nullable, FK → profiles.id, `ON DELETE SET NULL`) to `evidence_entries` |

---

## barriers

| column | type | notes |
|--------|------|-------|
| id | uuid | PK |
| school_id | uuid | FK → schools.id |
| domain_id | uuid | FK → domains.id — NOT a text field, always a UUID |
| sub_domain_id | uuid | FK → sub_domains.id — nullable |
| description | text | |
| student_groups | jsonb | **Object format**, keyed by short lowercase group keys with no `grp_` prefix: `'{"send": true, "pp": false, ...}'::jsonb` — despite this doc previously (incorrectly) describing it as a string array. Confirmed canonical Session 46 by reading the actual read/write code (`App.jsx`, `MATDashboard.jsx`) and cross-checked against `generateReport.js`'s dual-shape defensive handling, which suggests some historical rows may not conform — but object-keyed is what all current code writes and expects. Keys in use: `send` / `pp` / `eal` / `fsm` / `lac` / `wwc` / `social_care` / `young_carer` / `mental_health_support` / `other`. This doc correction is documentation-only — no data migration was performed on existing rows. |
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

---

## friction_logs

The "Flag an issue" note on a provision point row. Not previously documented here —
live-verified 2026-09-20.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| school_id | uuid | Nullable. FK → schools.id, `ON DELETE CASCADE` |
| provision_point_id | uuid | Nullable. FK → provision_points.id, `ON DELETE CASCADE` |
| provision_label | text | Denormalised copy of the point's label at the time it was flagged |
| domain_name | text | Denormalised |
| sub_domain_name | text | Denormalised |
| note | text | The flag's free-text note |
| created_at | timestamptz | Default `now()` |
