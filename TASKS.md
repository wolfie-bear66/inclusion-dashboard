# Inclusion Dashboard — Task Tracker

Project: `wolfie-bear66/inclusion-dashboard`
Working directory: `C:\Users\USER\Inclusion Dashboard`
Live URL: `https://inclusion-dashboard.vercel.app`

Last updated: 12 June 2026 (Session 9)

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

---

## Up next (priority order)

### Immediate

- [ ] **Home screen redesign** — once school context is on the home screen (Session 6), refine the landing to feel like a proper entry point: 86% readiness headline, six domain RAG cards, school context panel, prompt toward domains with gaps.

### Pilot and validation

- [ ] **Additional staff logins — St Augustine** — offer logins to SENCO and assistant head alongside headteacher. Introduce naturally in follow-up meeting.

- [x] **"Flag this" friction logger** — flag button on every provision point row (both domain and category views); inline panel with optional note; saves to `friction_logs` table in Supabase; flag button highlights red when flagged; existing flags loaded on school login. (Session 9)

- [ ] **Rydell High seed data** — populate Rydell High from publicly available school documents for MAT demo.

- [ ] **RLS policy on `mats` table** — fix so "Demo MAT" displays correctly in MAT dashboard header.

### Analytics

- [ ] **Outcomes & Impact tab search** — now filter UI is removed, consider a simple search box to help users navigate long outcome card lists.

### Commercial preparation

- [ ] **MAT demo walkthrough** — prepare structured demo script using Springwell and Rydell High. Open with headteacher pain points before introducing features. Key commercial decisions: subscription ownership, named users, pilot scope.

- [ ] **Landing page contact form** — wire up Formspree on existing landing page so inbound interest from MAT demo can be captured.

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
