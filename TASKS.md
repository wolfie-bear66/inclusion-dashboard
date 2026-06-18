# Inclusion Dashboard — Task Tracker

Project: `wolfie-bear66/inclusion-dashboard`
Working directory: `C:\Users\USER\Inclusion Dashboard`
Live URL: `https://inclusion-dashboard.vercel.app`

Last updated: 18 June 2026 (Session 12 — invite user, category nav fix, accordion)

---

## How to use this file

- Keep this file in the root of the repo (`TASKS.md`)
- At the start of each Claude / Claude Code session, paste the relevant section as context
- Mark tasks `[x]` when complete and add a brief note of what was done
- Add new tasks under the relevant section as they arise

---

## Completed

- [x] **Login / auth** — Supabase auth with RLS
- [x] **Domain navigation** — six domains with status buttons and evidence modal
- [x] **Evidence modal** — costs, outcomes, document links, student group reach, intended outcomes
- [x] **Analytics** — Domain Readiness, Enrichment Equity, Funding & Cost, Outcomes & Impact, Group Reach tabs
- [x] **PDF export** — 3-page landscape report (school context, domain readiness, enrichment equity, funding, outcomes)
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
- [x] **Session 10 — Public landing page** — full marketing landing page at `/` (Nav, Hero, Problem, Solution, How It Works tabs, Six Domains Bento, MAT/Trust CTA, Testimonial, Pricing/CTA, Footer). Formspree contact form wired to `https://formspree.io/f/mdavvadd` with hidden `enquiry_type` field (school / mat), inline submit confirmation, and inline error handling. All styles use existing CSS custom properties. `LandingPage.jsx` + `LandingPage.css` created in `src/pages/`.
- [x] **Auth-based routing** — authenticated users at `/` redirect to `/dashboard`; unauthenticated users at `/dashboard` redirect to `/`. Added to routing block in `src/App.jsx`.
- [x] **Vercel SPA rewrite** — added `vercel.json` with `/(.*) → /index.html` rewrite so deep links (e.g. `/dashboard`, `/demo`) resolve correctly after deploy.
- [x] **`/demo` public auto-login route** — `DemoAutoLogin` component signs in as `demo@testschool.co.uk` and redirects to `/dashboard` on success, shows error state on failure. Route is exempt from all auth redirect rules.
- [x] **`/demo` redirect loop fix (Session 10)** — moved `/demo` check before the `authLoading` gate so `DemoAutoLogin` always mounts; component now owns the full redirect via `useEffect` (checks existing session first, then signs in). Eliminated render-phase `window.location.replace` that was racing with `onAuthStateChange`.
- [x] **Session 11 — Design system applied (cosmetic pass)** — full 13-step design system applied across `index.html`, `index.css`, `App.css`, `App.jsx`. Changes: Inter font via Google Fonts; full `:root` CSS custom property block (neutral, brand, RAG, domain identity, node states, typography, charting layers); header/buttons/login to brand navy `#1B365D` (hover `#152A4A`); sidebar background `#F0F2F5` with navy active states (`rgba(27,54,93,0.10)`); domain identity palette applied to sidebar dots, analytics charts, and `DOMAIN_COLOUR_MAP` (SEND `#4338CA`, Equity `#7A5C13`, Attendance `#0E6251`, Enrichment `#6B21A8`, Belonging `#334E68`, Wellbeing `#5B3A9C`); RAG status colours standardised to `#257A3B` / `#D4751A` / `#EA4335`; all progress bars → `#E2E8F0` track / `#1B365D` fill (neutral) or domain/RAG colour; card borders `#E2E8F0`; ACard shadow updated; chart fills updated (radar → `#4A90D9`, funding bar → `#1B365D`). No logic, routing, or data fetching changed.
- [x] **Session 11 — Sidebar accordion** — replaced three independent open booleans (`sidebarDomainsOpen`, `sidebarCatsOpen`, `sidebarAnalyticsOpen`) with single `activeSidebarSection` string (null when all closed). Opening any section now automatically closes the previously open one. Toggle: clicking an open section closes it; clicking a different one switches to it. No other sidebar logic affected.
- [x] **Session 12 — Invite user feature** — Supabase Edge Function at `supabase/functions/invite-user/index.ts` calls `admin.auth.admin.inviteUserByEmail` and inserts a profile row. Approver-only "Add user" button in sidebar footer opens a modal (email + role select). Frontend fetch includes `Authorization: Bearer <session token>` and `apikey` headers. Env var: `SERVICE_ROLE_KEY`. Deploy: `supabase functions deploy invite-user --project-ref zgolrthcrupvrrvfokvz`.
- [x] **Session 12 — Category view navigation fix** — sidebar category links were setting `overviewMode='category'` but the `!selectedDomain` render block always showed the home screen regardless. Restored the category card grid and domain-grouped provision point list as an early-return branch inside the same IIFE, matching the pre-redesign behaviour.
- [x] **Session 12 — Domain sub-section accordion** — only one sub-domain section can be open at a time within a domain view. `toggleSD` now returns `new Set([sdId])` (open one, close all others) or `new Set()` (close if already open).

---

## Up next (priority order)

### Immediate

- [x] **Home screen redesign** — greeting with first name, overall readiness % + progress bar, reviews due panel (teal, hidden if none), RAG-sorted domain cards in 3×2 grid. (Session 12)

### Pilot and validation

- [ ] **Additional staff logins — St Augustine** — offer logins to SENCO and assistant head alongside headteacher. Introduce naturally in follow-up meeting.

- [x] **"Flag this" friction logger** — flag button on every provision point row (both domain and category views); inline panel with optional note; saves to `friction_logs` table in Supabase; flag button highlights red when flagged; existing flags loaded on school login. (Session 9)

- [ ] **Rydell High seed data** — populate Rydell High from publicly available school documents for MAT demo.

- [ ] **RLS policy on `mats` table** — fix so "Demo MAT" displays correctly in MAT dashboard header.

### Analytics

- [x] **Outcomes & Impact filter pills reinstated** — All / By Domain / By Group / By Sub-domain mode toggle with multi-select pills, Clear button, and result count line. Separate from Report Builder filter. (Session 9)

### Commercial preparation

- [ ] **MAT demo walkthrough** — prepare structured demo script using Springwell and Rydell High. Open with headteacher pain points before introducing features. Key commercial decisions: subscription ownership, named users, pilot scope.

- [x] **Landing page contact form** — Formspree wired up (see Session 10 above). ✓

---

## Future features

### Staff Ownership & Onboarding Flow
Status: Deferred — build after first trial cohort confirmed
Priority: High (impacts activation, retention, and sales story)

**What it is**
A responsibility layer that assigns each provision point to a named staff member, transforming the tool from a single-user compliance log into a whole-school system.

**Onboarding sequence**
1. Head signs up and logs in
2. Prompted to add team members (name, role, email) — soft prompt, not a hard gate
3. Invite emails sent → staff get school-scoped accounts via Supabase auth
4. Head assigns provision points to named staff (unassigned points flagged as a gap)
5. Staff log in → directed to their assigned points, ordered by ease of completion (logic TBD)

**UI changes required**
- New "Team" management screen for the Inclusion Lead (head)
- Assignment interface on each provision point (dropdown of school staff)
- "All provision / My provision" toggle across domain and category views
- "Unassigned" filter for the Inclusion Lead
- Staff-filtered view for line management / appraisal conversations

**Data model changes required**
- New `school_users` or extend existing profiles table with role field
- New `owner_id` field on provision_points table (nullable, FK to profiles)
- Invite flow via Supabase auth (email invite → school-scoped RLS on signup)
- RLS policies updated to respect owner visibility where needed

**Trigger for building**
At least one school has agreed a trial period with multiple staff users identified. Validate with headteacher that they would use the assignment step before building.

**Notes**
- Keep to single owner per provision point (no shared ownership at this stage)
- "Ease of completion" ordering for staff onboarding = likely based on category type (Policy/Published Document easier than Staff Training & CPD) + current status
- This is the activation mechanism that gets beyond the single power user ceiling
- Strong sales story for MATs: accountability gaps visible at trust level

**Build estimate**
Approximately 4–6 Claude Code sessions. Longest pole is the invite and school-scoped user profile layer (1–2 sessions). Assignment UI (1 session), My provision toggle (1 session), onboarding prompt + unassigned flagging (1 session), RLS testing and edge cases (1 session).

**Risk level: Moderate**
- Add `owner_id` as nullable column only — existing provision point data unaffected
- RLS policies are the highest-risk touch point — read current policies before any migration runs
- MAT dashboard queries must explicitly exclude ownership filtering or they will break
- Build invite/profile layer first in isolation, test, then add assignment UI in a separate session
- Never rewrite existing query logic in the same session as the migration

---

## Post-validation / future

- [ ] **Student belonging survey feature** — downloadable template with aggregated score input. Instruments researched: PSSM, BeeWell, Children's Happiness Scale.

- [ ] **Outcomes Tracker** — CSV upload for mock exam results with demographic tags, user-guided column highlighting, national DfE benchmark comparisons, calendared upload cadence aligned to secondary school mock schedule.

- [ ] **Radial Map view** — visual 4-level hierarchy alternative to linear domain view (Core → Domain → Sub-domain → Point). Deferred until core audit is validated.

- [ ] **Companion product decisions** — use early customer conversations to decide which of Cove, Revision Hub, and six-week reflective diary to formalise as ecosystem package.

---

## Known issues / technical debt

- [ ] Sub-domains RLS errors appearing in console — pre-existing, not blocking, needs investigation.
- [ ] `evidenceEntries` is empty on category view (domain-specific fetch only) — existing behaviour, not broken, but worth revisiting if evidence needs to show in category view.
- [ ] Customise Supabase invite email to mention the Inclusion Dashboard by name and give the user context about what they're signing up for.

---

## Reference

### Demo accounts
- Demo: `demo@testschool.co.uk` / `DemoAccess2026!`
- Pilot: `aquarless@staugustine.sjcmat.co.uk` (isolated from Demo MAT)

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
