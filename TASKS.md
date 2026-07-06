# Inclusion Dashboard — Task Tracker

Project: `wolfie-bear66/inclusion-dashboard`
Working directory: `C:\Users\USER\Inclusion Dashboard`
Live URL: `https://inclusion-dashboard.vercel.app`

Last updated: 6 July 2026 (Session 39 — Review-reminder copy branching + fast-confirm)

---

## How to use this file

- Keep this file in the root of the repo (`TASKS.md`)
- At the start of each Claude / Claude Code session, paste the relevant section as context
- Mark tasks `[x]` when complete and add a brief note of what was done
- Add new tasks under the relevant section as they arise

---

## Completed

- [x] **Session 38 — Experts at Hand structured evidence capture** — Adds a generalisable `evidence_type` + `structured_detail` (jsonb) pair to `evidence_entries` (`migrations/step9_expert_engagement_evidence.sql`), rather than one-off columns, so future provision points can reuse the same mechanism. First (and currently only) consumer: "Experts at Hand service accessed and used" (`f8509db3-b3d7-44a8-a061-b6f8a05848f1`, SEND — Specialist Provision). `evidence_type` CHECK: `standard` (default, used everywhere else) / `expert_engagement`. `structured_detail` shape for the latter: `{ professional_type, commissioning_route, activity_type, pupils_reached, report_received }`. Also added `experts_at_hand` to the `evidence_entries.funding_source` CHECK constraint (this is a plain text column with a CHECK, not a Postgres enum — the migration drops and recreates the constraint) and to the `FUNDING_SOURCES` UI list in `App.jsx`, plus a matching `entries.funding_source` FYI note in `SCHEMA_REFERENCE.md` (that column is unused by the app — left untouched). **Evidence modal:** five new inputs (Professional Type, Commissioning Route, Activity Type dropdowns; Pupils Reached number; Written Report Received checkbox) render additively — alongside, not replacing, the existing generic fields — gated purely on `modalPoint.id === EXPERTS_AT_HAND_PP_ID`, independent of the pre-existing `provision_category` (student-facing/policy-structural/whole-school/legacy) branching that drives the rest of the modal. Saved via the existing flat `draft` object / `handleModalSave` upsert path, with `evidence_type: 'expert_engagement'` stamped on only for this point; every other provision point is untouched (`evidence_type` stays `'standard'`, `structured_detail` stays `null`). **Outcomes & Impact tab:** `OutcomesImpact`'s row filter now also includes `evidence_type === 'expert_engagement'` rows (previously required `intended_outcomes`/`impact_on_outcomes`/`evidence_notes` to be non-empty, which would have hidden expert-engagement rows with only structured data filled in); adds one line per matching row in the existing card format, e.g. "Experts at Hand — SALT input Autumn Term — Speech and Language — 11 pupils received direct SALT input". No new tab, no new chart. Verified end-to-end: schema via a rolled-back transactional insert; UI via the live demo (Springwell Academy) — modal renders the new fields only on Experts at Hand and not on other Specialist Provision points; a temporary real row (inserted and deleted via SQL, demo-mode writes are a no-op client-side) confirmed the Outcomes & Impact rendering. `SCHEMA_REFERENCE.md`'s `evidence_entries` table definition also brought up to date with the live schema (~40 columns; the doc previously listed only 4) as part of this session.

  **Deferred:** a dedicated analytics visualisation for specialist/expert engagement (e.g. professional-type breakdown, commissioning-route spend) — parked pending pilot volume from St Augustine. Revisit once there's enough `expert_engagement` evidence data to make a chart meaningful.

- [x] **Session 39 — Review-reminder copy branching + fast-confirm for static points** — Home screen "Evaluate & Sustain — due this term" panel (`App.jsx`) now branches reminder copy on `provision_points.category`, joined in via `ppInfoMap` (which now also carries `category`) — **not** `evidence_entries.provision_category`, which is a different, pre-existing field (`student_facing`/`policy_structural`/`whole_school`) unrelated to this feature. Two category buckets: **Static/declarative** (`Named Person`, `Policy / Published Document`) — copy names the linked document (`named_role_policy_document`, hyperlinked via `supporting_document_link` when present) and asks if it's still current; falls back to a plain prompt when no document link exists. **Live/cumulative** (`Direct Provision for Students`, `Staff Training & CPD`, `External Partnership`, `Family & Community Engagement`, `Monitoring & Data`) — copy references `brief_description` and how long ago it was logged (`date_started`, falling back to `created_at`), asking if anything's happened since; falls back to "No engagement logged yet for this point" when neither date exists. Any other category (currently just `Internal Process / System`) keeps the original plain-label rendering, unchanged. New shared `formatTimeAgo()` helper produces the relative-time phrasing ("10 days ago", "4 years ago", etc.), used by both branches. New "Confirm still current" button, static categories only: stamps `date_last_reviewed = today` and advances `next_review_due` via a new shared `calculateNextReviewDue(reviewCycle, fromDate)` function (single source of truth — no existing review_cycle → date calculation was found anywhere in the codebase prior to this session; `review_cycle`/`date_last_reviewed`/`next_review_due` were three independent manual inputs in the evidence modal). Mapping: `weekly` → +7 days, `half_termly` → +6 weeks, `termly` → +12 weeks (**flat approximation, not calendar-term-aware** — known simplification, revisit if terms drift noticeably from a fixed 12-week cadence), `annual` → +1 year, `as_needed` or unset `review_cycle` → no calculation, button hidden/disabled. Button also hidden under `readOnly` (MAT admin viewing another school) and `isDemoMode`. Writes only `date_last_reviewed`/`next_review_due` on the existing `evidence_entries` row — no evidence modal opened, no new entry created, no other field touched. Per-row saving/error state; row drops out of the panel on success (no longer overdue). **Deliberately out of scope:** Analytics → Domain Readiness → Compliance Forecast panel — a second, separate reminder surface showing the same underlying data on a 60-day window instead of overdue-only — left untouched this session. Verified against live Supabase data: category branching checked across all 7 real in-use categories (13 currently-overdue rows sampled); fast-confirm update reused against a real static `evidence_entries` row (Race Equality Lead, `annual` cycle) and confirmed correct via re-query, then reverted to its original values.

- [x] **Session 37 — Report shows resolved barriers** — `drawBarriers()` in `src/generateReport.js` was silently filtering out any barrier with `status === 'resolved'` before it ever reached the table, so resolved barriers never appeared in generated PDF reports even when explicitly selected/relevant. Removed that filter (`let filtered = barriers ?? []`, domain/group filtering left untouched) so all barriers are now included regardless of status. `statusMap` gained a `resolved: 'Resolved'` label, and `didParseCell` gained a third branch rendering resolved rows in green (`GREEN`, `#257A3B`) for RAG consistency with the existing active=red/being_addressed=amber colouring.

- [x] **Session 36 — Academic year boundary fix** — Closes the date bug flagged in Session 33. `academicYear()` (`src/generateReport.js`) and its near-identical duplicate `defaultAcademicYearLabel()` (`src/pages/InclusionStrategyWizard.jsx`) both used `getMonth() >= 7` as the academic-year rollover boundary — 0-indexed month 7 is August, one month early against the correct UK Sept–Aug academic year. In practice this only ever affected dates falling in August: every August, the label jumped to the next academic year (e.g. "2026/27") a full month before the actual September 1 rollover, when it should still have read the previous year's label (e.g. "2025/26"). All other months were unaffected, since `>= 7` and the correct `>= 8` agree everywhere except at that single boundary month — confirmed via a console check comparing old vs. fixed output across September, December, January, July, and August, before changing any code. Fixed by changing the threshold to `getMonth() >= 8` (September) in both places. Label format (`"YYYY/YY"`, e.g. "2026/27") was already consistent between both implementations and untouched. Two other call sites of the same buggy logic (`generateReport()` landscape export and the legacy unused `generateInclusionStrategy()`, both already dead code per the Session 33 note) were left as-is, since they're not reachable from the UI. No changes to the Inclusion Strategy wizard's data model, RLS, invite-user permission logic, or anything else in the PDF export beyond the boundary calculation.

- [x] **Session 35 — invite-user privilege-escalation fix** — Closes the gap found in a service-role usage audit: `supabase/functions/invite-user/index.ts` used `SERVICE_ROLE_KEY` to call `auth.admin.inviteUserByEmail` and insert directly into `profiles`, but trusted `role`, `school_id`, and `mat_id` entirely from the client request body with no server-side check on who the caller actually was — the "approver/mat_admin only" gate was UI-only, so anyone with a valid session token could call the function directly (devtools/curl) to self-escalate their role or invite a user into any school/MAT. Fixed by adding, ahead of the existing invite/insert logic: (1) verifying the caller's identity via `admin.auth.getUser(token)` against the `Authorization` bearer token, rather than trusting any client-supplied id; (2) looking up the caller's own `profiles` row (`role`, `school_id`, `mat_id`) via the service-role client — a legitimate service-role use, since it establishes the caller's real permissions rather than trusting client input; (3) enforcing the permission rule — only `approver`/`mat_admin` may invite; `approver` may only invite into their own `school_id` and only as `contributor`; `mat_admin` may only invite into a school whose `schools.mat_id` matches their own `mat_id` (existing MAT-dashboard Team access), and only as `contributor` or `approver` — granting `mat_admin` is blocked outright for now, since mat_admin-minting is a deferred future feature. All rejections return `403` with a clear JSON error rather than a silent failure. Deployed and verified with direct HTTP calls against the live function (bypassing the UI): confirmed a legitimate mat_admin invite into their own school still succeeds; confirmed missing bearer token, invite into a school outside the caller's MAT, and an attempt to grant `mat_admin` are all correctly rejected with 403. No changes to the frontend, `profiles` schema, or read-only view logic. 1 July 2026.

- [x] **Session 34 — MAT admin read-only gate fix** — Fixes the bug flagged in Session 33: a MAT admin drilling into a school other than their own could interact with Barriers, Team, Report Builder, and the Inclusion Strategy wizard, but writes silently no-op'd under RLS with no UI feedback. Root cause confirmed by direct query against the live Supabase project: RLS on `barriers`/`inclusion_strategy_drafts`/`inclusion_strategy_priorities`/`school_context`/`friction_logs` all correctly scope writes to `school_id = get_my_school_id()` (or the equivalent inline subquery) — the gap was purely UI-level, no RLS changes made. Two additional screens with the same gap were found and fixed beyond the original four: the School Context Panel (Analytics screen) and the "Flag this" friction-log button on provision point rows. **Decision (confirmed with user):** MAT admins CAN edit their own affiliated school even when reached via the MAT dashboard drill-down — read-only is keyed off `viewed school_id !== own school_id`, not off the MAT-dashboard navigation path itself. This is a behaviour change from Session 33: previously every school reached via the MAT dashboard was unconditionally read-only, including the admin's own school. New shared hook `useIsReadOnlyView(userRole, ownSchoolId, viewedSchoolId)` in `src/hooks/useIsReadOnlyView.js` is now the single source of truth, replacing the old `view === 'school_readonly'`-only check — also applied to the pre-existing Evidence entry gating (status buttons, Add Evidence, evidence modal) for consistency, so the whole app behaves the same way for a given school regardless of which screen. Added `ownSchoolId` profile state in `App.jsx` (previously discarded for `mat_admin` role). New shared `ReadOnlyBanner` component (`src/components/ReadOnlyBanner.jsx`) replaces the old generic blue "read only" banner text app-wide with "You're viewing [School] as a MAT admin. This is read-only — switch to your own school to make changes." Screens updated: `BarriersView` (Add/Edit/Delete hidden), `TeamPage` (Invite user + Assign/Edit assignment hidden), `InclusionStrategyWizard` (all steps' inputs disabled, all write functions guarded — including the auto-create-draft-on-mount effect, which previously fired an insert attempt on every mount regardless of read-only state), `SchoolContextPanel` (Edit hidden, plus fixed a pre-existing bug where it optimistically updated local state before the write resolved and never checked the error), and the friction-flag button. Report Builder needed no changes — it has no write paths of its own (pure read + client-side PDF export), and the app-wide banner already covers it. **Separate bug fixed as a prerequisite:** `barriers` INSERT was missing `school_id` entirely (the column is `NOT NULL` with no default, confirmed via direct DB query) — every "Add Barrier" via the UI was failing for all users, MAT admin or not; fixed by adding `school_id: school` to the insert payload in `BarriersView.handleSave` ([App.jsx](src/App.jsx)), verified end-to-end via the live preview (`POST .../barriers → 201`). All fixes verified live via the demo `mat_admin` account (own school = Springwell Academy): editable on Springwell, correctly read-only with all write controls hidden on the other five MAT schools.

- [x] **Session 33 — Create Inclusion Strategy wizard (lite, first-year-only)** — New standalone area (separate from Generate Report) that guides a user through drafting the DfE statutory Inclusion Strategy statement, combining existing barriers/provision data with free-text authoring. **Deliberately a first-year-only "lite" version** — no year-on-year progress tracking, no carry-forward logic, no "review of the previous academic year" step. That longitudinal version is a deferred future build, pending pilot feedback on this one. New tables: `inclusion_strategy_drafts` (school-scoped draft row — setup fields, `barrier_ids uuid[]`, statement of intent, intended outcomes, further information, `status` draft/published) and `inclusion_strategy_priorities` (child rows per principle — `source_point_id` FK to `provision_points` when suggested from a gap, else manual, activity description, budgeted cost, funding source, sort order). RLS on both matches the existing `get_my_school_id()` pattern used on `barriers` (school-scoped CRUD + a MAT-admin-scoped read-only policy). New sidebar item "Create Inclusion Strategy" (top-level, between Barriers and Team), plus a secondary entry-point card at the top of the Generate Report screen. Six-step wizard in `src/pages/InclusionStrategyWizard.jsx`, autosaving the draft on every step transition (barrier selection and priority edits save immediately): (1) Setup — academic year, review date, authorised by; (2) Barriers — checkbox list of existing barriers with a "Select all" control, inline edit, add new; (3) Priorities & Activity — seven collapsible DfE principle sections with suggestion chips pulled from provision gaps, prioritised no-entry-yet first, then `not_in_place`, falling back to `in_progress` only when a principle has neither, plus manual add; (4) Statement of Intent — live word counter, soft warning past 500 words; (5) Intended Outcomes — three non-editable sentence-starter prompts; (6) Further Information + read-only Preview in DfE order, with a Generate PDF action. New export `generateInclusionStrategyDraft` in `generateReport.js` (portrait A4, navy `#1B365D` branding, matches existing export styling) — cover (school, academic year, review date, authorised by, barrier count), statement of intent, numbered barriers list, activity grouped by principle (description, activity, provision-gap/manual tag, cost/funding if present), intended outcomes, further information (only if non-empty). Built independently of the existing `generateEvidenceReport`/`full_strategy` purpose mode in Report Builder — that path is live-query driven around domains/barriers/funding and wasn't a good fit for the wizard's own draft/priorities data shape; the old unused `generateInclusionStrategy` legacy function was left untouched. **Known gap at the time, fixed in Session 34:** like `BarriersView` and `TeamPage`, the wizard didn't thread the app's `readOnly` flag — a MAT admin drilling into a school other than their own could open the wizard but writes silently no-op'd under RLS. See Session 34 entry above.

- [x] **Login / auth** — Supabase auth with RLS
- [x] **Domain navigation** — six domains with status buttons and evidence modal
- [x] **Evidence modal** — costs, outcomes, document links, student group reach, intended outcomes
- [x] **Analytics** — Domain Readiness, Enrichment Equity, Funding & Cost, Outcomes & Impact, Group Reach tabs
- [x] **PDF export** — rebuilt report generator (Session 32). New `generateEvidenceReport` function: portrait A4, cover page, 8 conditional sections, 4 purpose modes (Full Strategy Statement / Domain Focus / Compliance Snapshot / Outcomes Summary), domain scope pills, student group filter, provision view toggle (By Domain / By DfE Principle), Appendix B toggle. Fixes: "DfE" typo, footer → "Inclusion Dashboard · inclusiondashboard.co.uk", reviews window → overdue + 28 days only, Group Reach removed, Enrichment Equity moved into Section 5, date dynamic. New Report Builder panel replaces old section toggles. **Deferred pending pilot feedback:** Appendix B toggle default-on option; multi-year strategy narrative text field.
- [x] **School context panel** — migrated to Supabase `school_context` table with RLS
- [x] **By domain / by category toggle** — overview shows domain cards or category cards
- [x] **MAT dashboard** — RAG school pills, domain comparison, compliance forecast, funding accordion, spider diagram
- [x] **Category column** — added to `provision_points` table
- [x] **Session 1 — Sidebar navigation** — replaced top nav bar with persistent left sidebar (Home, Domains, Categories, Analytics, Generate Report)
- [x] **Session 2 — Analytics cleanup** — removed By Domain / By Group / By Sub-domain filter toggle from Outcomes & Impact tab
- [x] **Session 3 — Report Builder page** — new page with section toggles, chart style options, outcomes multi-select filter, sticky generate bar wired to generateReport
- [x] **Session 4 — Domain view redesign** — collapsible sub-domain sections with status stripe cards, fade truncation, Show all / Show less
- [x] **Session 5 — Category view redesign** — same collapsible pattern grouped by domain within each category
- [x] **Audit — codebase cleanup** — removed unused imports (PieChart, Pie), lifted 5 analytics components to module scope, extracted ProvisionPointRow and ShowToggle components, removed debug console.log calls
- [x] **Categories sidebar fix** — wired to PROVISION_POINT_CATEGORIES (Named Person etc.) not sub-domains
- [x] **Session 6 — School context on home screen** — extracted SchoolContextPanel to module scope, added to home screen above domain cards with overall readiness headline (large %, progress bar). schoolCtx state lifted to App level so both home and Analytics share the same data.
- [x] **Session 7 — PDF logic update** — rewrote `generateReport.js` to respond to all Report Builder options: conditional sections (equity, funding, outcomes, reach), chart style choices (table vs radar fallback / bar vs table), outcomes filter by domain/group/subdomain, group reach table and bar chart. Dynamic page count — footer `Page X of N` now reflects actual pages. Old fixed 3-page structure replaced with flowing y-position layout.
- [x] **Mobile / tablet sidebar** — added isMobile state (resize listener, <768px breakpoint), hamburger button (ti-menu-2) in main content area, overlay sidebar with backdrop (rgba 30% black), auto-close on nav item tap. Desktop behaviour unchanged.
- [x] **MAT dashboard mobile sidebar** — replicated App.jsx mobile sidebar pattern in MATDashboard.jsx: isMobile state, sidebarOpen (default false on mobile), resize listener, hamburger (ti-menu-2) in main content area, overlay sidebar with backdrop (rgba(0,0,0,0.3)), auto-close on nav tap. Desktop unchanged.
- [x] **MAT dashboard mobile panel layout** — attention and reviews panels now stack vertically on mobile (<768px) via isMobile prop passed to HomeView; removed overflow/ellipsis/nowrap truncation from review item names so text wraps naturally; card horizontal padding set to 16px on both panels. Desktop two-column layout unchanged.
- [x] **SCHEMA_REFERENCE.md updated** — added `entries` and `evidence_entries` table definitions. Documented that the only valid status values are `in_place`, `in_progress`, `not_in_place`; `complete` does not exist and must never be used.
- [ ] **MAT dashboard 0% readiness — investigate** — `status === 'complete'` does NOT appear in MATDashboard.jsx; all status checks already use `in_place`. Most likely root cause: the `sub_domains(domain_id)` nested join in the provision_points query is failing silently due to pre-existing sub_domains RLS errors (noted in Known Issues), leaving `ppToDomain` empty so the matrix is never incremented. Check browser console for Supabase errors on the entries/sub_domains queries when the MAT dashboard loads.
- [x] **Session 10 — Public landing page** — full marketing landing page at `/` (Nav, Hero, Problem, Solution, How It Works tabs, Six Domains Bento, MAT/Trust CTA, Testimonial, Pricing/CTA, Footer). Formspree contact form wired to `https://formspree.io/f/mdavvadd` with hidden `enquiry_type` field (school / mat), inline submit confirmation, and inline error handling. All styles use existing CSS custom properties. `LandingPage.jsx` + `LandingPage.css` created in `src/pages/`.
- [x] **Auth-based routing** — authenticated users at `/` redirect to `/dashboard`; unauthenticated users at `/dashboard` redirect to `/`. Added to routing block in `src/App.jsx`.
- [x] **Vercel SPA rewrite** — added `vercel.json` with `/(.*) → /index.html` rewrite so deep links (e.g. `/dashboard`, `/demo`) resolve correctly after deploy.
- [x] **`/demo` public auto-login route** — `DemoAutoLogin` component signs in as `demo@testschool.co.uk` and redirects to `/dashboard` on success, shows error state on failure. Route is exempt from all auth redirect rules.
- [x] **`/demo` redirect loop fix (Session 10)** — moved `/demo` check before the `authLoading` gate so `DemoAutoLogin` always mounts; component now owns the full redirect via `useEffect` (checks existing session first, then signs in). Eliminated render-phase `window.location.replace` that was racing with `onAuthStateChange`.
- [x] **`/demo` mobile flicker fix (multi-session)** — hardened `DemoAutoLogin` with `useRef` attempted guard + one-shot `onAuthStateChange`; froze `pathname` in `pathnameRef = useRef(window.location.pathname)` to prevent mid-render routing changes; added opaque `LoadingScreen` (position fixed, inset 0) used by both `DemoAutoLogin` and the `authLoading` gate; moved `/demo` to be the absolute first route evaluated (before static pages and all auth guards) and switched to `startsWith('/demo')` to handle trailing-slash normalisations added by Vercel or mobile browsers.
- [x] **Session 11 — Design system applied (cosmetic pass)** — full 13-step design system applied across `index.html`, `index.css`, `App.css`, `App.jsx`. Changes: Inter font via Google Fonts; full `:root` CSS custom property block (neutral, brand, RAG, domain identity, node states, typography, charting layers); header/buttons/login to brand navy `#1B365D` (hover `#152A4A`); sidebar background `#F0F2F5` with navy active states (`rgba(27,54,93,0.10)`); domain identity palette applied to sidebar dots, analytics charts, and `DOMAIN_COLOUR_MAP` (SEND `#4338CA`, Equity `#7A5C13`, Attendance `#0E6251`, Enrichment `#6B21A8`, Belonging `#334E68`, Wellbeing `#5B3A9C`); RAG status colours standardised to `#257A3B` / `#D4751A` / `#EA4335`; all progress bars → `#E2E8F0` track / `#1B365D` fill (neutral) or domain/RAG colour; card borders `#E2E8F0`; ACard shadow updated; chart fills updated (radar → `#4A90D9`, funding bar → `#1B365D`). No logic, routing, or data fetching changed.
- [x] **Session 11 — Sidebar accordion** — replaced three independent open booleans (`sidebarDomainsOpen`, `sidebarCatsOpen`, `sidebarAnalyticsOpen`) with single `activeSidebarSection` string (null when all closed). Opening any section now automatically closes the previously open one. Toggle: clicking an open section closes it; clicking a different one switches to it. No other sidebar logic affected.
- [x] **Session 12 — Invite user feature** — Supabase Edge Function at `supabase/functions/invite-user/index.ts` calls `admin.auth.admin.inviteUserByEmail` and inserts a profile row. Approver-only "Add user" button in sidebar footer opens a modal (email + role select). Frontend fetch includes `Authorization: Bearer <session token>` and `apikey` headers. Env var: `SERVICE_ROLE_KEY`. Deploy: `supabase functions deploy invite-user --project-ref zgolrthcrupvrrvfokvz`.
- [x] **Session 12 — Category view navigation fix** — sidebar category links were setting `overviewMode='category'` but the `!selectedDomain` render block always showed the home screen regardless. Restored the category card grid and domain-grouped provision point list as an early-return branch inside the same IIFE, matching the pre-redesign behaviour.
- [x] **Session 12 — Domain sub-section accordion** — only one sub-domain section can be open at a time within a domain view. `toggleSD` now returns `new Set([sdId])` (open one, close all others) or `new Set()` (close if already open).
- [x] **Session 13 — Provision Depth heat map grids** — replaced the four Recharts bar charts in `ProvisionDepth` with heat map grids. Each of the four categories (Staff Training & CPD, External Partnership, Family & Community Engagement, Direct Provision for Students) renders as an `ACard` with provision points grouped by domain. Cells are 28×28px; colour scale: 0 entries `#e8edf2`, 1–2 `#7B9FBF`, 3+ `#1B365D` (white count label). Domain filter pills apply to all grids. Fixed-position hover tooltip shows provision point name, domain, and entry count. Recharts imports retained (still used by FundingCost).
- [x] **Session 13 — Hero copy update** — heading changed to "Inclusion, evidenced in full." and subheading to "See every gap, organise improvements, report with confidence." in `LandingPage.jsx`.
- [x] **Session 14 — Springwell evidence enrichment (categories 4–7)** — `springwell_evidence_v2.sql` ensures entries exist (status complete) for all provision points in Staff Training & CPD, External Partnership, Family & Community Engagement, Direct Provision for Students, and adds one rich evidence_entry per provision point with realistic data (dates, costs, impact notes, group reach flags). Added 22 June 2026.
- [x] **Session 14 — Rydell High seed data** — `rydell_high_v2.sql` populates all provision points for Rydell High with a non-compliant status mix. Named Person and Policy complete; Monitoring & Data in_progress; External Partnership and Family & Community Engagement not_started; Enrichment, Belonging, Wellbeing domains predominantly not_started. ON CONFLICT DO NOTHING preserves any 3 existing entries. Added 22 June 2026.
- [x] **Heat map colour scale recalibrated** — 5-step scale replacing the original 3-step. 0 → `#E5E7EB`, 1 → `#C7D9EE`, 2 → `#8FB8D8`, 3–4 → `#4A7FA8`, 5+ → `#1B365D`. Count label now only shown at 5+ (was 3+). Added 23 June 2026.
- [x] **Session 15 — Demo route → MAT dashboard** — `DemoAutoLogin` now sets `sessionStorage.isDemoMode = 'true'` and redirects to `/mat-dashboard` (was `/dashboard`). Both redirect paths (existing session + fresh sign-in) updated. `/mat-dashboard` falls through to the main authenticated app; `mat_admin` role sets `view = 'mat'` → MAT dashboard renders correctly.
- [x] **Session 15 — MAT dashboard school cards** — Added prominent school selector cards to `MATDashboard.jsx` (above divergence alert). Each card shows school name, overall readiness %, RAG colour (green ≥70%, amber 40–69%, red <40%), descriptor line, and "Explore this school →" CTA button (navy). Two-column auto-fit grid, collapses to single column on mobile.
- [x] **Session 15 — Demo mode guidance text** — `isDemoMode` prop added to `MATDashboard`. When true, shows instructional text above school cards: "Explore either school to see how Inclusion Dashboard works in practice — one model school, one that needs attention."
- [x] **Session 15 — Demo mode read-only banner** — Amber banner ("You're viewing a demo school. Changes won't be saved.") shown in `App.jsx` when `isDemoMode && readOnly`. Replaces the existing blue read-only banner for demo sessions. NOTE: writes not yet suppressed — see new task above.
- [x] **Session 15 — RLS policy on mats table** — Verified existing policy "mat members can read their mat" already correct. No change needed.
- [x] **Session 16 — Demo routing fix** — `handleDemoLogin` (sign-in page) changed from direct `signInWithPassword` to `window.location.href = '/demo'`. `DemoAutoLogin` gains a separate mount-time `useEffect` that sets `sessionStorage.demoEntry = 'true'`. App.jsx routing block (after `authLoading` gate) checks for `demoEntry`: if found with active session, consumes flag, sets `isDemoMode`, and `window.location.replace('/mat-dashboard')`. Overriding redirect was in `handleDemoLogin` bypassing `DemoAutoLogin` entirely.
- [x] **Session 16 — Landing page hero dual dashboard panel** — Two-line hero subheading. School card (Springwell, domain colour dots, "Explore school dashboard →") + MAT card (Demo MAT, green/red school dots, navy border, RECOMMENDED badge, "Explore MAT dashboard →"). Both link to `/demo`. Note: "Both dashboards are fully interactive. No sign-up required." Nav label updated to "Try the demo — MAT view first →".
- [x] **Hero section declutter** — Removed second subheading, friction-removal line, "See how it works" link, regulatory trust line, and MAT/School Dashboard labels. Hero now reads: eyebrow → headline → single subheading → CTA button → image. Session 18.
- [x] **Session 18 — Landing page CTA and hero image overhaul** — Nav: "Try the demo" (navy fill, primary), "Get in touch" (plain link → #contact), "Sign in" (ghost); removed "Book a demo". Hero: single "Explore the live demo →" CTA + friction line + "See how it works ↓" text link, replacing dual dashboard cards. Hero image replaced with `hero-dashboard.png` in clickable wrapper with hover overlay; MAT/School labels above. Bottom CTA section replaced with `#contact` section ("Built by a teacher, for teachers", Formspree form, mailto fallback). All remaining "Book a demo" references removed.
- [x] **Session 17 — Fix persisted session breaking demo routing** — `DemoAutoLogin` refactored from `onAuthStateChange`-based flow to `async/await`. On mount: sets `demoEntry` flag, then `await supabase.auth.signOut()` (clears any localStorage-cached session), then `signInWithPassword`, then sets `isDemoMode` + `window.location.replace('/mat-dashboard')`. Sign-out is the first async step — guarantees a clean auth cycle for returning visitors. Mobile loop fix (`attempted.current` ref) preserved — it guards re-runs, not session state. `console.log` trace at each step for browser debugging.
- [x] **Session 19 — MAT dashboard full rebuild — Home + Schools views** — `MATDashboard.jsx` fully rebuilt. Removed: yellow divergence alert, domain×school comparison matrix table, school name pills in header, legend. Added: persistent left sidebar (Home/Schools/Domains/Categories/Analytics, brand navy active state, 220px, `#F0F2F5` bg). Home view: trust header panel (name, subtitle, 51% trust-wide readiness, "X of Y provision points across N schools"), school cards with RAG % + dynamic active pp count + domain mini-bar (6 coloured segments) + "Explore school →" CTA, two-column attention panel (systemic gaps where >1 school below 40%) + reviews due panel (fetched from `evidence_entries.next_review_due` within 30 days, capped at 8). Schools view: sortable table (school name / overall % RAG badge / points evidenced / reviews due count / last activity / domain chips / view school link). Domains, Categories, Analytics: stub panels ("coming in a future update"). All data fetched once on mount via `activePpCount` query (`provision_points WHERE active = true`), entries query, and evidence_entries reviews query. Data: trust readiness 51% (170/332), Springwell 86%, Rydell High 17%. Reviews due query working (20 Springwell items returned).
- [x] **Session 30 — EEF Implementation Guide references** — Copy-only changes: landing page How It Works and Solution sections; onboarding prompt States A/C/D framing lines; Barriers empty state with GOV.UK link; Evaluate & Sustain cycle field helper text. Improvement #6 complete. 28 June 2026.
- [x] **Session 30 — Barriers demo data seeded — all 6 schools** — 15 barriers inserted across Springwell (3), Rydell High (4), Sunnydale (2), Bayside (2), Capeside (2), North Shore High (2). 14 of 15 linked to provision points via barrier_provision_links. Rydell LAC named person barrier intentionally unlinked — no matching provision point in framework. Status mix: resolved, being_addressed, active reflects each school's inclusion narrative. 28 June 2026.
- [x] **Session 30 — MAT Barriers Intelligence view** — Three-panel view in MATDashboard.jsx (465 lines added, nothing removed). Panel 1: Provision Point Barrier Lens — school chips per point (navy=resolved, amber=active/being_addressed, grey=entry no barrier), expanded per-school cards with description, status badge, actions, student group tags, scale/source. Panel 2: Gaps without a named barrier — not_in_place entries with no barrier linked, grouped by school and domain, success line if all gaps covered, capped at 10 with Show all toggle. Panel 3: Shared barrier patterns — domain+subdomain combos across 2+ schools, per-barrier sub-rows with school chip, status badge, truncated actions with Show more. Domain and status filters. Sidebar nav item between Categories and Analytics. 28 June 2026.
- [x] **Session 31 — MAT Barriers view bug fixes** — Four issues diagnosed and resolved. (1) Removed redundant `.in('school_id', matSchoolIds)` filter from barriers fetch — RLS policy `barriers_select_mat_admin` handles scoping; the filter was causing race condition with empty array. (2) Moved barriers + barrier_provision_links fetch inside the `try` block in `loadData` — it was outside, so a `cancelled = true` cleanup firing mid-effect silently skipped `setBarriers`. (3) Replaced nested `entries!inner(...)` join on `barrier_provision_links` fetch with flat `select('id, barrier_id, entry_id')` — entries RLS was blocking the cross-school join for mat_admin. (4) Added RLS policy `mat_admin can read barrier_provision_links` in Supabase (joining through barriers → schools → profiles) — existing `barrier_links_select` policy was scoped to `get_my_school_id()` (Springwell only), returning 3 of 14 links. All 15 barriers now display correctly across all three panels for all 6 demo schools. 28 June 2026.

---

## Up next (priority order)

### Immediate

- [x] **Home screen redesign** — greeting with first name, overall readiness % + progress bar, reviews due panel (teal, hidden if none), RAG-sorted domain cards in 3×2 grid. (Session 12)
- [x] **Fix MAT dashboard home — school card order and attention panel logic** — Cards now sorted by in_place count descending (highest-performing school always left). Attention panel logic replaced: shows any school with one or more domains below 40%, with gaps ordered lowest % first. Rydell High now correctly shows 5 domains (Enrichment 3%, Belonging 6%, Wellbeing 9%, Equity 17%, Attendance 22%). SEND at 46% correctly excluded. Session 19.
- [x] **MAT dashboard — build Domains view** — 6 domain pill buttons (identity colours, active = filled); sub-domain table with per-school RAG chips (green ≥70%, amber 40–69%, red <40%, grey = no data); column headers show school name + "X% in this domain"; Points column shows active pp count; sub-domains with 0 active points hidden; empty state message if no data. Data computed client-side from extended `provision_points` query (now includes `sub_domain_id`) + new `sub_domains` fetch + existing entries — no extra Supabase queries on pill click. Session 19.
- [x] **MAT dashboard — build Categories view** — 8 categories in defined order (Named Person → Direct Provision for Students), summary banner ("X of 8 categories need attention"), overview table with per-school % chips and trust avg, expandable rows showing per-provision-point status chips (one-at-a-time accordion). Data computed client-side from existing ppMeta + ppEntryMap — no extra queries. Session 19.
- [x] **MAT dashboard — build Analytics view** — two tabs: Provision Depth (school pill toggle, 4 heat map grids by category×domain, reusing school analytics heat map pattern; evidence count per cell from extended entries query including `evidence_entries(id)`) and Trust Trajectory (stacked bar chart per school — in_place/in_progress/not_in_place, 3 summary stat cards with trust-wide totals). Session 19.
- [x] **Fix report generation — empty PDF** — Root cause: `ReportBuilder.handleGeneratePdf` was calling `generateReport` with hardcoded empty arrays (`readinessData: []`, `allEvidence: []`, etc.) — no Supabase fetch was ever made. Fix: `ReportBuilder` now accepts `supabase`, `school`, `schoolCtx` props; `handleGeneratePdf` is now async and runs the same entries + domains fetch as `AnalyticsView`, computes `readinessData`, `allEvidence`, `upcomingReviews`, `fundingSourceData`, `fundingDomainData`, `totalCost`, `equityData` client-side, then calls `generateReport`. Button shows "Generating…" disabled state during fetch; inline error shown on failure. Call site updated to pass the three new props. Session 20.
- [x] **Bolder demo banner (Option C)** — background `#FDEFD8`, left border `6px solid #D4751A`, main text `font-weight: 600`. Inner yellow read-only bar ("Changes won't be saved.") untouched. Session 20.
- [x] **MAT Dashboard amber pill** — "MAT Dashboard" back-button in `school_readonly` breadcrumb restyled: background `#D4751A`, white bold text, `6px 14px` padding, `border-radius: 999px`, hover `#b86215`. Session 20.
- [x] **MAT dashboard school cards — RAG hairline bars** — replaced `DomainMiniBar` (6 domain-colour segments) with `RAGHairlineBars`: three stacked 4px bars (green `#4CAF50` / amber `#F59E0B` / red `#EF4444`), each on a `#E5E7EB` track, widths driven by `inPlace / total`, `inProgress / total`, `notInPlace / total`. `schoolStats()` extended to return `notInPlace`. Card dimensions, padding, and button unchanged. Session 20.
- [x] **Demo banner CTA** — full-width dismissible banner (background #FFF8EE, left border #D4751A) shown below header when `sessionStorage.demoEntry === 'true'`. Text left, "Get in touch →" mailto link + × dismiss right. Dismissed state persisted to `sessionStorage.demoBannerDismissed`. Mobile: wraps to two rows via flexWrap. Session 20.
- [x] **Exit demo button** — header Sign Out button replaced with "Exit demo" when `isDemoMode`. On click: Supabase sign out → `sessionStorage.clear()` → `window.location.replace('/')`. Real users see unchanged "Sign out" behaviour. Session 20.
- [ ] **Gather pilot user feedback on Domains vs Categories view preference (drill-down vs overview)**
- [x] **Fix MAT Analytics Provision Depth data** — Root cause: `ppMeta` did not include `domain_id`, so `heatGroupsForCategory` filtered out all provision points (`pp.domain_id` falsy → 0 groups). Fix: added `domain_id: pp.sub_domains?.domain_id ?? null` to ppMeta build in load function. Data and domain ID lookups all verified correct via diagnostic logs. Session 19.
- [ ] **MAT dashboard Analytics — expand Provision Depth and Trust Trajectory based on pilot user feedback**
- [ ] **Review full MAT dashboard with pilot school before next feature build**
- [x] **MAT dashboard — phase filter on Schools table** — `phase TEXT CHECK (primary/secondary/all_through/special)` added to `schools` via `step8_school_phase.sql`; demo schools backfilled by name. `SchoolsView` gains pill filter row (All / Primary / Secondary / All-through / Special); null-phase schools appear under All only; client-side filter applied before sort. Schools fetch updated to include `phase`.

### Pilot and validation

- [ ] **Additional staff logins — St Augustine** — offer logins to SENCO and assistant head alongside headteacher. Introduce naturally in follow-up meeting.

- [x] **"Flag this" friction logger** — flag button on every provision point row (both domain and category views); inline panel with optional note; saves to `friction_logs` table in Supabase; flag button highlights red when flagged; existing flags loaded on school login. (Session 9)

- [x] **Rydell High seed data** — `rydell_high_v2.sql` seeds all provision points with non-compliant status mix (Named Person/Policy complete; Monitoring in_progress; Enrichment/Belonging/Wellbeing not_started). Added 22 June 2026.

- [x] **Landing page: expose MAT view in demo mode** — Added MAT subsection to Section 7 with headline "Built for MATs — see every school at a glance", body copy, placeholder screenshot frame, and "See it in the demo →" CTA. Updated "Analyse" tab demo link copy to "Try a live demo — start with the MAT overview →". Session 15.
- [ ] **MAT dashboard: full review pass** — review layout, contrast, and data accuracy after landing page MAT demo is in place.
- [x] **RLS policy on `mats` table** — Confirmed existing policy "mat members can read their mat" already in place (SELECT where id = profile's mat_id). No action needed. Session 15.

- [x] **Fix demo routing to land on MAT dashboard** — Root cause: `handleDemoLogin` (sign-in page "Explore Demo" button) was calling `supabase.auth.signInWithPassword` directly, bypassing `DemoAutoLogin` entirely — no `isDemoMode` was set and no redirect to `/mat-dashboard` fired. Fix: (1) `handleDemoLogin` now navigates to `/demo` so all demo sign-ins go through `DemoAutoLogin`. (2) `DemoAutoLogin` sets `sessionStorage.demoEntry = 'true'` on mount (insurance). (3) App.jsx routing block checks for `demoEntry` after auth settles and redirects to `/mat-dashboard` if found, consuming the flag. `demoEntry` flag is set in `DemoAutoLogin`, consumed in App routing. Session 16.
- [x] **Landing page hero dual dashboard panel** — Hero updated with two-line subheading, school card (Springwell Academy, domain dots) and MAT card (Demo MAT, Springwell/Rydell indicators, navy border + RECOMMENDED badge), both linking to `/demo`. Centred note "Both dashboards are fully interactive. No sign-up required." below. Nav "Try the demo" updated to "Try the demo — MAT view first →". Single hero CTA button row removed. Session 16.
- [ ] **Replace MAT dashboard screenshot placeholder on landing page with real screenshot** — `lp-mat__img` div in `LandingPage.jsx` Section 7 currently shows placeholder text. Replace with actual screenshot once MAT view is confirmed working in production.
- [ ] **Review landing page on mobile — check hero image scaling and nav items at small viewport**
- [ ] **Replace placeholder testimonial quotes with real ones when available**
- [ ] **Verify demo routing fix for returning users** — Test: (1) sign in as demo account via normal login, stay signed in, (2) navigate to landing page, (3) click "Try the demo — MAT view first →", (4) confirm browser console shows `[DemoAutoLogin]` sign-out + sign-in logs and user lands at `/mat-dashboard`. Browser console logs are now in place for this trace.
- [ ] **Verify demo mode read-only banner displays correctly on mobile** — amber banner ("You're viewing a demo school. Changes won't be saved.") shown when `isDemoMode && readOnly`. Test on iOS Safari and Android Chrome.
- [x] **Suppress writes in demo mode** — `if (isDemoMode) return` guard added as the first line of both `handleStatusChange` and `handleModalSave` in `App.jsx`. Verified no guard was previously present. Debug console logs in `MATDashboard.jsx` confirmed already removed (no `console.log` calls found). Session 24.
- [x] **Session 28 — Barriers to learning feature** — `BarriersView` component added to `App.jsx`. Part 1: "Barriers" sidebar nav item (ti-alert-triangle icon) between Domains and Categories. Part 2: list view with header, domain/status/group filter bar, barrier cards (domain colour left border, description, group tags, scale/source badges, status badge, linked provision points expandable, E&S date, edit/delete buttons), empty states. Part 3: Add/Edit modal with all fields (description, domain, sub-domain, student groups, scale, source, status, actions, linked provision points multi-select with search, date identified, next E&S date). Save: INSERT/UPDATE barrier then DELETE + re-INSERT barrier_provision_links. Routing: `selectedDomain === 'barriers'` guard added to domain view exclusion condition and data fetch guard. 27 June 2026.

### Analytics

- [x] **Outcomes & Impact filter pills reinstated** — All / By Domain / By Group / By Sub-domain mode toggle with multi-select pills, Clear button, and result count line. Separate from Report Builder filter. (Session 9)

### Commercial preparation

- [ ] **MAT demo walkthrough** — prepare structured demo script using Springwell and Rydell High. Open with headteacher pain points before introducing features. Key commercial decisions: subscription ownership, named users, pilot scope.

- [x] **Landing page contact form** — Formspree wired up (see Session 10 above). ✓

---

## Future features

### Reviews due panel — copy fix
**Priority: Low — do alongside any home screen work**
Relabel "Reviews due" panel to "Evidence due for review" across home screen and
personal view. Review dates sit on evidence entries, not provision points. The
distinction matters for accuracy and to avoid confusion with the approval flow.
Review cadence for provision points is a head decision, not a dashboard function.

---

### Staff Ownership & Onboarding Flow
Phase 1 complete — onboarding_state column added to profiles; point_assignments table created with RLS policies.
Phase 2 complete — Team screen built with By Person and By Point views; assignment modal writes to point_assignments table; sidebar updated.
Phase 3 complete — personal view toggle added with role-appropriate controls; domain cards and reviews panel filter by assignment; background colour shift applied to personal view.
Phase 4 complete — OnboardingPrompt (4 states A/B/C/D) for approvers on first login; AssignmentModal extracted to shared component; sidebar Team button flash animation on skip-without-team; contributor welcome banner; second_login_or_later and welcomed columns migrated.
Tidy-up complete — skip no longer clears category selections; Invite user moved from sidebar into Team screen.
Status: Complete
Priority: High (impacts activation, retention, and sales story)
Trigger: At least one school with multiple named staff ready to trial.
Validate with headteacher that they would use the assignment step before building.
Note: Self-assignment part could be built independently as a lower-risk first step.

---

**What it is**
A responsibility layer assigning each provision point to a named staff member.
Transforms the tool from a single-user compliance log into a whole-school system.
Replaces current "Add user" sidebar button with a full "Team" screen for approvers.

---

**Approver first login prompt**

On first login the head sees a three-way prompt (soft — not a hard gate):
- "Assign points to myself"
- "Add team members"
- "Skip for now"

"Assign points to myself" disappears permanently after it has been entered once,
regardless of how much was assigned. No completion detection — head decides
what's theirs by what they leave unassigned to others.

After any action completed, prompt reappears with updated language:
- "Add another team member"
- "Come back to it later"

Once at least one team member exists, a fourth option appears:
- "Done — notify my team"

On second login with no assignments made, prompt reappears automatically.
Options: start assigning, or "Don't show this again."
If dismissed permanently: notification appears — "You can come back to team
setup any time using the Team button." Team button in sidebar then flashes
briefly (3–4 pulses) then stops. Continuous flash rejected — too persistent
given deliberately low-pressure tone.

Onboarding state tracked via `onboarding_state` JSON field on profiles table:
- `self_assign_entered` (boolean)
- `has_team_members` (boolean)
- `team_prompt_dismissed` (boolean)

---

**Onboarding setup sequence (person by person)**

For each team member:
1. Enter name, role, email
2. Shown Named Person points → select which belong to this person
3. Shown Policy/Published Document points → select
4. Shown Monitoring & Data points → select
5. Prompt: "Add another person" or "Continue to next category (4/8)"

Category counter (e.g. 4/8) shows progress without forcing completion.
Head can stop at any point and notify the team with whatever is assigned.

When "Complete team" selected, confirmation screen shows:
> "[X]/166 points assigned. [Y] unassigned. Notify team?"

Unassigned count shown alongside assigned — surfaces accountability gaps
before anyone has logged in.

No autosuggestions based on role — head knows their team.
Designed to work on a projected screen in a staff meeting as well as solo.
The setup act itself is a compliance act: unassigned = visible gap.

---

**Invite email (sent on "Notify team?")**
Personalised — names the head, school, number of assigned points, first point.
Example: "[Head name] has set up your Inclusion Dashboard account for [School].
You've been assigned 8 provision points to complete — starting with [point name].
Your role in building the school's Inclusion Strategy starts here."
Hints that additional points may follow beyond their assigned set.

---

**Team screen (ongoing management — approver only)**

"Team" sidebar item visible to approver role only. Replaces "Add user" button.
Two switchable views within the same screen:

View by person:
- Select staff member → see all assigned points
- Add points, remove points, reassign to another staff member
- "Transfer all" action for staff transitions (see below)

View by point:
- Browse all provision points, filterable by domain or category
- Each point shows current owner or "Unassigned"
- Assign, reassign, or deselect from here

Both views support: assign, deselect/remove, reassign.

"Add team member" button at top of Team screen — triggers same name/role/email
flow as initial setup, then drops into point assignment for that person.
This is how new staff are invited after initial onboarding is complete.

---

**Staff transition flow (member leaves)**

From View by person → select departing staff member → "Transfer or remove":
1. Shows all points currently assigned to that person
2. "Transfer all to..." — dropdown of current staff, one action
3. Or selective transfer — tick individual points, assign to different people
4. Option to deactivate departing staff member's login
5. Untransferred points return to unassigned → home screen nudge reappears

---

**Personal view (home screen)**

Home screen structurally identical for all users but toggled by role.

Non-approvers land on personal view by default:
- Domain cards show only assigned points
- Domain with no assigned points shows "Belonging: 0 out of 0 complete"
  (not hidden — honest and complete)
- "Evidence due for review" panel shows only their evidence review dates
- Overall readiness % stays whole-school (school metric, not personal)
- Toggle: My provision / Whole school

Approvers (head) get a dropdown instead of toggle:
- Whole school / My provision / [named staff member]
- Named staff member view enables line management conversations without
  a separate screen

Non-approver first login — personal view is default landing state. Points
that require only a name, date, or an already-available document should be
surfaced first. "You can probably complete these now" is a legitimate UI
affordance — gives first session momentum, makes tool feel useful not
bureaucratic.

---

**Approval flow**

Home screen (approver only): line at bottom of overall readiness panel:
> "4 points waiting for your approval →"

Clicking opens modal or page listing those points with point names and links.

Two actions per point:
- Approve → point moves to green, contributor sees sign-off
- Return with comment → point returns to amber, contributor notified,
  comment visible to both approver and contributor

Each provision point needs a small comment thread (not full messaging —
just a simple exchange for the approval conversation). Can be actioned
in or out of inclusion meetings.

No hard "deny" — return with comment is more useful and keeps the
conversation in the tool rather than moving it to email.

---

**Email digests**

Weekly personal digest (non-approvers):
- Their completion picture
- Evidence entries with upcoming review dates
- Single most pressing call to action
- Not a list of everything undone — one thing, one link to personal view

Weekly summary (approver/head), scannable in under two minutes:
1. What needs attention now — expiring evidence review dates, approval queue count
2. Recent progress — completed/evidenced in last 7 days, with contributor name
3. Overall picture — domain RAG status, completion %, trend if history exists
4. Coming up — evidence review dates in next 2–4 weeks

Deep links to specific points rejected — SPA routing makes these fragile and
restructuring routing carries breakage risk. Instead: point names listed in
email body, one link to personal view (already filtered and sorted by urgency).
Recipient lands in the right place without per-point URLs.

---

**Data model changes required**
- Extend profiles table: `onboarding_state` JSON field, role field (if not present)
- New nullable `owner_id` on `provision_points` (FK to profiles)
  — nullable so Springwell and St Augustine pilot data unaffected
- Comment thread storage on provision points (simple array or child table)
- RLS policies: read current policies before any migration runs
- MAT dashboard queries must explicitly exclude ownership filtering

---

**Build estimate**
Approximately 6–9 Claude Code sessions total across all components:
- Onboarding prompt + state tracking: 1 session
- Team screen (both views, assign/deselect/reassign): 2 sessions
- Self-assignment flow + setup sequence: 1–2 sessions
- Personal view toggle + dropdown: 1 session
- Approval flow + comment thread: 1–2 sessions
- Email digest infrastructure: 1–2 sessions
- RLS verification, staff transition, edge cases: 1 session

Invite/profile layer (Session 12) already built — do not rebuild.
Build onboarding prompt and Team screen first, in isolation.
Never rewrite existing query logic in same session as any migration.

**Risk level: Moderate-High across full feature set**
- `owner_id` nullable column — safe for existing data
- RLS policies highest-risk touch point — verify before any migration
- MAT queries must explicitly exclude ownership filtering
- Comment thread is new data structure — design carefully to avoid
  coupling it to future messaging features
- Email digest requires either a Supabase Edge Function cron job or
  external service (e.g. Resend, Loops) — infrastructure decision needed
  before building

---

## Post-validation / future

- [ ] **Expert engagement analytics visualisation** — dedicated view for `expert_engagement` evidence (professional-type breakdown, commissioning-route spend, pupils reached over time). Parked pending pilot volume from St Augustine — not enough data yet to make a chart meaningful. See Session 38.

- [ ] **Student belonging survey feature** — downloadable template with aggregated score input. Instruments researched: PSSM, BeeWell, Children's Happiness Scale. Links to Line 445 ## Future Idea

- [ ] **Outcomes Tracker** — CSV upload for mock exam results with demographic tags, user-guided column highlighting, national DfE benchmark comparisons, calendared upload cadence aligned to secondary school mock schedule.

- [x] **Founder admin view (private)** — `/admin` route built in `src/pages/AdminView.jsx`. UUID guard on mount redirects non-founders to `/`. Table shows per school: MAT, total evidence entries, entries in last 30 days, last entry date, team members, unassigned points, domain coverage % (colour-coded cells), reports (n/a). Separate Supabase queries assembled in JS. Session 24.
- [x] **Session 25 — Principle Coverage analytics tab** — New "Principle Coverage" tab added to Analytics after Domain Readiness. Horizontal stacked bar chart (Recharts) shows RAG breakdown per DfE principle. Summary table below chart with totals and % complete. Data: fetches all active provision_points with principle column; cross-joins with entries status map; points with no entry count as not_in_place. PRINCIPLES constant defines fixed order of 7 principles. RAG_COLOURS constant added at module level.
- [x] **Session 27 — Improvement 5: Evaluate & Sustain labelling** — UI copy change only. Four label replacements in App.jsx: home screen reviews panel heading → "Evaluate & Sustain — due this term"; evidence modal "Date Last Reviewed" → "Date Last Evaluated & Sustained"; "Next Review Due" → "Next Evaluate & Sustain Date"; "Review Cycle" → "Evaluate & Sustain Cycle". Analytics Compliance Forecast sub-heading updated to use "evaluate & sustain date" language. Database field names (`next_review_due`, `review_cycle`) and React state unchanged. MAT dashboard untouched.
- [x] **Session 27 — Improvement 7: Universal/Targeted badges and filter** — Part A: `universal_or_targeted` added to domain view provision_points select query. `ProvisionPointRow` shows a pill badge (Universal: `#DBEAFE`/`#1E40AF`, Targeted: `#EDE9FE`/`#5B21B6`) between the label and evidence count badge. Part B: segmented filter control (All / Universal / Targeted) above the sub-domain list in domain view; sub-domains with 0 visible points are skipped; filter resets to "All" on domain change. Part C: read-only "Provision type" badge injected into evidence modal between the modal header and modal body; uses same pill styling as Part A; only renders when value is set.
- [x] **Session 26 — Funding & Cost tab rebuild** — `FundingCost` component fully replaced. Panel 1 "Provision by Funding Source": derives data from `analyticsEntries` directly (no computed props); groups evidence_entries by funding_source; counts distinct provision_point_ids per source; sums cost; displays as grouped horizontal bar chart (dual x-axis: count bottom, cost £k top) plus summary table (Funding Source / Provisions / Total Cost, dash for zero cost). Panel 2 "Inclusive Mainstream Fund — Spend by Principle": filters for `inclusive_mainstream_fund`, groups by `provision_points.principle`, shows all 7 principles in fixed DfE order (muted text for zero rows), totals row. Both panels show neutral empty states if no data. `FUNDING_FULL_LABELS` and `FUNDING_SOURCE_ORDER` constants added at component scope. `FundingCost` now takes `analyticsEntries` prop only — old computed funding props removed from call site.
- [x] **Session 25 — Inclusion Strategy PDF export** — New `generateInclusionStrategy` export in `generateReport.js`. Portrait A4 layout. Cover page (navy background, school name, "Inclusion Strategy [academic year]", date generated). Per-principle sections: principle heading band, "X of N provision points in place" sub-heading, each in-place/in-progress point with status badge, label, entries.what, entries.evidence_notes. Excludes not_in_place points. Report Builder now shows two option cards at top: "Working Report" (existing behaviour) and "Inclusion Strategy" (new). Sticky bar description updates to reflect selected type.
- [x] **MAT Barriers Intelligence view** — Three-panel view: Provision Point Barrier Lens (school chips per point, expanded barrier detail with actions), Gaps without a named barrier (not_in_place entries with no barrier linked, grouped by school and domain), Shared barrier patterns (domain+subdomain groups appearing across 2+ schools). Domain and status filters. Sidebar nav item between Categories and Analytics. 28 June 2026.
- [x] **Improvement 6 — EEF Implementation Guide references** — Copy-only changes — landing page How It Works and Solution sections, onboarding prompt States A/C/D, Barriers empty state with GOV.UK link, E&S cycle helper text. 28 June 2026.
- [x] **Session 32 — Landing page four-step restructure** — How It Works section restructured from three tabs to four. New Step 2 "Identify" added with barrier identification copy (EEF implementation cycle framing), heading, and `/barriers-dashboard.png` image. Step 3 "Analyse" image updated to `/analysis-dashboard.png`. Step 4 "Report" image updated to `/report-dashboard.png`. Section heading updated to "four steps". Eyebrow pill updated to "Inclusion Strategy deadline: 31 Dec 2026 · Full statutory compliance: 2028–29". Problem section heading changed to "The challenge schools are navigating" with new body paragraph (7 principles framing). Hero image ref updated to `/hero-dashboard.png`. MAT section image ref updated to `/mat-dashboard.png`. 29 June 2026.
- [x] **Session 29 — Connect barriers to Inclusion Strategy PDF** — `generateInclusionStrategy` now accepts `barriers` param (fetched in App.jsx alongside entries/pps, excluding resolved). Domain→principle map derived from provision points data. Each principle section: amber barriers block (header band, per-barrier rows with description, domain/sub-domain, status/scale/group tags, actions) shown before provision evidence; sub-heading updated to "X of N provision points in place · Y barrier(s) identified" when barriers present. Cover page shows "Barriers identified: N" in amber when N > 0. Principles with no barriers render unchanged. Working Report export untouched. 28 June 2026.
- [x] **Session 33 — Landing page six-step restructure** — How It Works section expanded from four tabs to six, matching the new "Assign → Evidence → Identify Barriers → Build the Strategy → Report → Review" cycle. Old "Analyse" tab retired (`analysis-dashboard.png` left in place in `/public`, unused, in case it's wanted elsewhere later). New static cycle diagram (`cycle-diagram-six-steps.png`) added above the tabs, always visible regardless of active tab. Section headline replaced with "How Inclusion Dashboard works — one continuous cycle". New Step 6 "Review" has no image; tab panel renders cleanly with no image (existing conditional render + `min-height: 400px` on `.lp-how__tab-panel` already handled this — no layout shift). Image consolidation: `step1-assign.png`, `barriers-dashboard.png`, `step4-build-strategy.png`, `report-dashboard.png`, `cycle-diagram-six-steps.png` moved from `/public` into `/public/images/landing`, joining `howitworks-evidence.png`. All `img` paths in `LandingPage.jsx` updated to match. New `.lp-how__diagram` CSS rule added in `LandingPage.css`. 2 July 2026.
- [x] **Session 34 — Cycle diagram moved into Review tab** — `cycle-diagram-six-steps.png` relocated from its static position above the tabs into the "Review" tab's content, using the same `img`/`imgAlt` pattern and `lp-how__tab-img` class as the other five tabs. Static image and its wrapper removed from above `.lp-how__tabs`; now-unused `.lp-how__diagram` CSS rule removed from `LandingPage.css`. Section headline "How Inclusion Dashboard works — one continuous cycle" kept in place as the general section title (reads fine without the diagram directly beneath it). Review tab body copy unchanged. 2 July 2026.

## MAT-wide Barriers Intelligence view for approvers (parked — build only 
if a MAT requests it)

**Status:** Designed, not built. Do not build speculatively.

**What it is:** Gives head teachers (approver role) optional read-only 
visibility into barriers, actions, and gap data across every school in 
their MAT — not just their own school — so heads can see what other 
schools are doing and reach out directly, without waiting for meetings.

**Design decisions already made:**
- Reuses the existing `MATBarriersView` component unchanged — it is 
  already read-only and fit for purpose as the approver-facing view.
- Enabled per-MAT, not globally: add a `barriers_sharing_enabled` boolean 
  column on the `mats` table, default `false`. Only flip to `true` for a 
  specific MAT once they've explicitly opted in.
- Approver's own Barriers screen gets a "My School" / "Trust-wide" toggle, 
  visible only when their MAT has `barriers_sharing_enabled = true`.
- RLS: new SELECT-only policy on `barriers`, `barrier_provision_links`, 
  and `entries` allowing approver role to read rows where the school's 
  `mat_id` matches their own school's `mat_id` — resolved via a 
  school-to-school join (my school's mat_id = target school's mat_id), 
  NOT via `profiles.mat_id`, since approver profiles do not reliably have 
  `mat_id` populated even when their school belongs to a MAT. This was 
  flagged explicitly as a likely silent-failure point if built the 
  wrong way.
- Write access (INSERT/UPDATE/DELETE on barriers) remains school-scoped 
  only — trust-wide visibility is read-only, full stop.
- Linked documents: a plain URL field pointing to an external file 
  (e.g. Microsoft 365 link). No file storage build needed — access is 
  naturally gated by the viewer's own tenant login. Nothing for the 
  product to host or manage.

**Not yet decided (resolve with the MAT at the time, not in advance):**
- Whether all heads see everything by default, or whether the MAT's 
  central team wants to curate/redact before trust-wide visibility 
  (relevant for sensitive barrier descriptions, e.g. LAC or 
  safeguarding-adjacent framing).

**Trigger to revisit:** A MAT (via LinkedIn outreach or otherwise) asks 
for cross-school visibility for their heads.

## Future Idea: Provider Suggestions / Marketplace (post-paying-schools)

**Status:** Idea only — not scoped, not scheduled. Revisit once real paying schools exist.

**Concept:** Use aggregated provision data (esp. External Partnership heat map / gaps in 
provision) to surface suggestions for external providers who could fill those gaps.

Two distinct models to keep separate:
1. **Affiliate/referral** — e.g. Outward Bound, overnight experiences, other external 
   providers. Commission-based. Requires affiliate disclosure + privacy/consent updates.
2. **Own products cross-sell** — e.g. Cove (parent chatbot), Revision Hub, surfaced as 
   relevant suggestions based on identified gaps. No affiliate disclosure needed, but 
   still needs clear framing so it doesn't feel like a bait-and-switch.

**Trigger point:** Likely built on top of existing External Partnership heat map data 
(Provision Depth analytics) — low-engagement/gap cells are the natural surface point.

**Open questions for later:**
- Consent/privacy policy implications of using school data this way
- Whether this is a MAT-level or school-level feature
- Pricing/commission model if going the affiliate route
- Does this dilute the "compliance tool, not vendor" positioning that's worked so far?

---

## Known issues / technical debt

- [x] Sub-domains RLS errors appearing in console — pre-existing, not blocking, needs investigation.
- [x] `evidenceEntries` is empty on category view — fixed. Lifted the full `ENTRY_SELECT` fetch to the school-level `useEffect` (was per-domain); domain-level effect now only fetches sub_domains. Both Domain and Category views read from the same shared `evidenceEntries` state.
- [x] **Invite form updated** — now collects first name, last name, job title, and email; profile row created automatically on invite (first_name, last_name, onboarding_state, welcomed); job_title column added to profiles (step7_job_title.sql); job_title moved to client-side update after Edge Function invite — schema cache workaround; By Person view shows job_title instead of role chip when available; contributor welcome banner personalised with first name and point count; Edge Function redeployed.
- [x] **Set password page built** — invited users now land on /set-password before entering the dashboard. SetPasswordPage handles its own session wait (invite-link hash consumed by Supabase JS); auth listener intercepts SIGNED_IN with type=invite hash as belt-and-suspenders. Redirect URL in Supabase must be set to https://inclusiondashboard.co.uk/set-password.
- [x] **Set-password intercept fixed** — replaced URL-hash detection (unreliable: hash is cleared before React renders) with a `password_set` boolean column on profiles (default false). On every login, if profile.password_set === false the app routes to SetPasswordPage before anything else. SetPasswordPage sets password_set = true on the profile after updateUser succeeds, then navigates to /home. Migration: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set BOOLEAN DEFAULT false; UPDATE profiles SET password_set = true WHERE created_at < NOW() (run in Supabase SQL Editor to protect existing users).
- [ ] Customise Supabase invite email to mention Inclusion Dashboard by name and give context about what they're signing up for.

---

## Reference

### Demo accounts
- Demo: `demo@testschool.co.uk` / `DemoAccess2026!`
- Pilot: `aquarless@staugustine.sjcmat.co.uk` (isolated from Demo MAT) / `AQstaugs123`
- Admin: `syates@staugustine.sjcmat.co.uk` / `Austin101`

### Key dates
- White paper published: 23 February 2026
- Consultation closed: 18 May 2026
- Full statutory compliance expected: 2028–29
- Children's Wellbeing and Schools Act: Royal Assent 29 April 2026

### Regulatory sources to monitor
- *Every Child Achieving and Thriving* white paper
- Children's Wellbeing and Schools Act 2026
- Enrichment Framework (due 2025–26 academic year)
- Pupil Engagement Framework (due 2025–26 academic year)
- National Inclusion Standards (expected by 2028)
- Disadvantage funding consultation (Summer 2026)

### Stack
- React + Vite, Supabase (auth + PostgreSQL + RLS), Recharts, jsPDF, Vercel
- Supabase project ID: `zgolrthcrupvrrvfokvz`
- Google Drive project folder: `1-RbNb1Js7w3qZcBBCyoIR2oWFqeiCaor`
