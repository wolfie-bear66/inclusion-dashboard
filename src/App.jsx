import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import MATDashboard from './MATDashboard'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import TeamPage from './pages/TeamPage'
import InclusionStrategyWizard from './pages/InclusionStrategyWizard'
import OnboardingPrompt from './components/OnboardingPrompt'
import BootstrapWizard from './components/BootstrapWizard'
import MyPointsQueue from './components/MyPointsQueue'
import { PRINCIPLE_LABEL_SHORT, STATIC_REVIEW_CATEGORIES } from './constants/principles'
import ApprovalQueueModal from './components/ApprovalQueueModal'
import AssignmentModal from './components/AssignmentModal'
import SetPasswordPage from './pages/SetPasswordPage'
import AdminView from './pages/AdminView'
import SchoolOnboardingView from './pages/SchoolOnboardingView'
import { useIsReadOnlyView } from './hooks/useIsReadOnlyView'
import { usePrincipleCoverage } from './hooks/usePrincipleCoverage'
import ReadOnlyBanner from './components/ReadOnlyBanner'
import { computeCounts } from './utils/computeCounts'
import './App.css'
import { generateEvidenceReport } from './generateReport'
import { generateEvidenceReportWord } from './generateReportWord'

// ── Invite-link detection ─────────────────────────────────────────────
// Must run at module evaluation, before Supabase auth initialises and
// consumes (clears) the URL hash during getSession().  If the hash
// contains 'type=invite' or 'type=signup' we store a flag so the
// onAuthStateChange SIGNED_IN handler can redirect to /set-password.
;(function detectInviteHash() {
  const hash = window.location.hash
  console.log('[Invite] initial hash on load:', hash || '(empty)')
  if (hash.includes('type=invite') || hash.includes('type=signup')) {
    console.log('[Invite] invite hash detected — setting pendingSetPassword flag')
    sessionStorage.setItem('pendingSetPassword', 'true')
  }
})()

const STATUSES = ['in_place', 'in_progress', 'not_in_place']
const STATUS_LABELS = { in_place: 'In Place', in_progress: 'In Progress', not_in_place: 'Not In Place' }
const SEND_TIERS = [
  { value: 'universal',     label: 'Universal' },
  { value: 'targeted',      label: 'Targeted' },
  { value: 'targeted_plus', label: 'Targeted Plus' },
  { value: 'specialist',    label: 'Specialist' },
]
const FUNDING_SOURCES = [
  { value: 'pupil_premium',             label: 'Pupil Premium' },
  { value: 'send_budget',               label: 'SEND Budget' },
  { value: 'inclusive_mainstream_fund', label: 'Inclusive Mainstream Fund' },
  { value: 'sport_premium',             label: 'Sport Premium' },
  { value: 'school_general_budget',     label: 'School General Budget' },
  { value: 'experts_at_hand',           label: 'Experts at Hand' },
]
const INDICATOR_TYPES = [
  { value: 'named_role',         label: 'Named Role' },
  { value: 'policy',             label: 'Policy' },
  { value: 'programme',          label: 'Programme' },
  { value: 'external_service',   label: 'External Service' },
  { value: 'curriculum_element', label: 'Curriculum Element' },
]
const PROVISION_POINT_CATEGORIES = [
  'Named Person',
  'Policy / Published Document',
  'Internal Process / System',
  'Staff Training & CPD',
  'Direct Provision for Students',
  'Monitoring & Data',
  'External Partnership',
  'Family & Community Engagement',
]
// STATIC_REVIEW_CATEGORIES is imported from ./constants/principles (shared with BootstrapWizard.jsx)
// Live/cumulative points: reminder copy references the most recent logged entry.
const LIVE_REVIEW_CATEGORIES = [
  'Direct Provision for Students', 'Staff Training & CPD', 'External Partnership',
  'Family & Community Engagement', 'Monitoring & Data',
]

// Single source of truth for review_cycle → next_review_due. Reused by the
// "Confirm still current" fast-confirm action so the date math never drifts
// out of sync with wherever else this gets called from later.
function calculateNextReviewDue(reviewCycle, fromDateStr) {
  if (!reviewCycle || reviewCycle === 'as_needed') return null
  const from = fromDateStr ? new Date(fromDateStr) : new Date()
  if (Number.isNaN(from.getTime())) return null
  const d = new Date(from)
  switch (reviewCycle) {
    case 'weekly':      d.setDate(d.getDate() + 7); break
    case 'half_termly': d.setDate(d.getDate() + 42); break // 6 weeks
    case 'termly':      d.setDate(d.getDate() + 84); break // 12 weeks — flat approximation, not calendar-term-aware
    case 'annual':      d.setFullYear(d.getFullYear() + 1); break
    default: return null
  }
  return d.toISOString().slice(0, 10)
}

// Relative "time ago" phrase for review-reminder copy.
function formatTimeAgo(dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((new Date() - then) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = Math.round(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}
const PROVISION_CATEGORIES = [
  { value: 'student_facing',    label: 'Student-Facing Intervention' },
  { value: 'policy_structural', label: 'Policy / Structural' },
  { value: 'whole_school',      label: 'Whole School Approach' },
]
const REACH_GROUPS = [
  { field: 'reach_send',  label: 'SEND' },
  { field: 'reach_pp',    label: 'PP' },
  { field: 'reach_eal',   label: 'EAL' },
  { field: 'reach_fsm',   label: 'FSM' },
  { field: 'reach_lac',   label: 'LAC' },
  { field: 'reach_wwc',   label: 'WWC' },
  { field: 'reach_social_care',            label: 'Social Care' },
  { field: 'reach_young_carer',            label: 'Young Carer' },
  { field: 'reach_mental_health_support',  label: 'Mental Health Support' },
  { field: 'reach_other', label: 'Other' },
]
const EV_GROUPS = [
  { value: 'grp_send', label: 'SEND' },
  { value: 'grp_pp',   label: 'PP' },
  { value: 'grp_eal',  label: 'EAL' },
  { value: 'grp_fsm',  label: 'FSM' },
  { value: 'grp_lac',  label: 'LAC' },
  { value: 'grp_wwc',  label: 'White Working Class' },
  { value: 'grp_social_care',           label: 'Social Care' },
  { value: 'grp_young_carer',           label: 'Young Carer' },
  { value: 'grp_mental_health_support', label: 'Mental Health Support' },
  { value: 'grp_other', label: 'Other' },
]

// provision_points.category values for which a contributor's "In Place" (with real
// evidence attached) writes status directly instead of going through approval —
// a one-line change to extend.
const DIRECT_INPLACE_CATEGORIES = ['Named Person']

// Provision point that gets the structured expert-engagement evidence fields
// (in addition to, not instead of, the generic evidence fields above).
const EXPERTS_AT_HAND_PP_ID = 'f8509db3-b3d7-44a8-a061-b6f8a05848f1'
const EXPERT_PROFESSIONAL_TYPES = [
  { value: 'salt',                     label: 'Speech and Language Therapist (SALT)' },
  { value: 'ot',                       label: 'Occupational Therapist (OT)' },
  { value: 'educational_psychologist', label: 'Educational Psychologist' },
  { value: 'qtod_qtvi',                label: 'QToD / QTVI' },
  { value: 'camhs_mhst',               label: 'CAMHS / MHST' },
  { value: 'other',                    label: 'Other' },
]
const EXPERT_COMMISSIONING_ROUTES = [
  { value: 'nhs_icb',           label: 'NHS / ICB' },
  { value: 'local_authority',   label: 'Local Authority' },
  { value: 'school_funded',     label: 'School Funded' },
  { value: 'mat_commissioned',  label: 'MAT Commissioned' },
]
const EXPERT_ACTIVITY_TYPES = [
  { value: 'individual_casework',  label: 'Individual Casework' },
  { value: 'group_work',           label: 'Group Work' },
  { value: 'whole_setting_audit',  label: 'Whole Setting Audit' },
  { value: 'staff_cpd',            label: 'Staff CPD' },
]
// Short forms used in the Outcomes & Impact summary sentence, e.g.
// "Experts at Hand — Speech and Language ... 11 pupils received direct SALT input"
const EXPERT_PROFESSIONAL_REPORT_LABEL = {
  salt:                     { name: 'Speech and Language',   input: 'SALT input' },
  ot:                       { name: 'Occupational Therapy',  input: 'OT input' },
  educational_psychologist: { name: 'Educational Psychology', input: 'EP input' },
  qtod_qtvi:                { name: 'QToD / QTVI',           input: 'QToD/QTVI input' },
  camhs_mhst:               { name: 'CAMHS / MHST',          input: 'CAMHS/MHST input' },
  other:                    { name: 'Specialist',            input: 'specialist input' },
}

// entries holds status + group flags; evidence detail lives in evidence_entries (nested)
const ENTRY_SELECT = [
  'id', 'provision_point_id', 'status', 'submitted_for_approval_at', 'send_back_note',
  'grp_send', 'grp_pp', 'grp_eal', 'grp_fsm', 'grp_lac', 'grp_wwc', 'grp_other',
  'evidence_entries(id, provision_name, brief_description, indicator_type, provision_category, named_role_policy_document, delivered_by, send_tiers, pupils_reached, reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc, reach_social_care, reach_young_carer, reach_mental_health_support, reach_other, grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_social_care, grp_young_carer, grp_mental_health_support, grp_other, date_started, date_last_reviewed, next_review_due, funding_source, cost, review_cycle, evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link, notes, evidence_type, structured_detail)',
].join(', ')

// ── Analytics sub-components ─────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#F7F8FA', fontFamily: 'var(--font-base)',
    }}>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1B365D', letterSpacing: '-0.3px' }}>
        Inclusion Dashboard
      </p>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 8 }}>Loading…</p>
    </div>
  )
}

const ACard = ({ children, className = '' }) => (
  <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', padding: 24 }} className={className}>{children}</div>
)
const ASectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 20 }}>
    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', letterSpacing: '-0.2px' }}>{children}</h2>
    {sub && <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>{sub}</p>}
  </div>
)
const AGroupPill = ({ label }) => (
  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#E2E8F0', color: '#64748b', fontWeight: 500, display: 'inline-block' }}>{label}</span>
)

const DOMAIN_COLOUR_MAP = [
  { key: 'SEND',       colour: '#4338CA' },
  { key: 'Equity',     colour: '#7A5C13' },
  { key: 'Attendance', colour: '#0E6251' },
  { key: 'Enrichment', colour: '#6B21A8' },
  { key: 'Belonging',  colour: '#334E68' },
  { key: 'Wellbeing',  colour: '#5B3A9C' },
]
const A_FALLBACK_COLOURS = ['#4338CA', '#7A5C13', '#0E6251', '#6B21A8', '#334E68', '#5B3A9C']
function aDomainColour(name = '', idx = 0) {
  const m = DOMAIN_COLOUR_MAP.find(d => name.includes(d.key))
  return m ? m.colour : A_FALLBACK_COLOURS[idx % A_FALLBACK_COLOURS.length]
}

// PRINCIPLE_LABEL_SHORT is imported from ./constants/principles (shared with BootstrapWizard.jsx)

// ── Sidebar domain colours (spec-provided) ────────────────────────────
const SIDEBAR_DOMAIN_COLOURS = {
  SEND:       '#4338CA',
  Equity:     '#7A5C13',
  Attendance: '#0E6251',
  Enrichment: '#6B21A8',
  Belonging:  '#334E68',
  Wellbeing:  '#5B3A9C',
}
function sidebarDomainColour(name) {
  for (const [key, colour] of Object.entries(SIDEBAR_DOMAIN_COLOURS)) {
    if (name.includes(key)) return colour
  }
  return '#64748b'
}

function Sidebar({
  domains, allSubDomains, ppDomainMap, allStatuses, schoolName,
  selectedDomain, setSelectedDomain,
  activeSidebarSection, setActiveSidebarSection,
  onGenerateReport,
  overviewMode, selectedCategory,
  setOverviewMode, setSelectedCategory,
  onClose,
  userRole, onInviteUser,
  flashTeam, onFlashTeamEnd,
}) {
  const sidebarCounts = computeCounts(Object.keys(ppDomainMap).map(id => ({ id })), allStatuses)
  const totalPP   = sidebarCounts.total
  const answered  = sidebarCounts.total - sidebarCounts.notStarted

  const isHome    = !selectedDomain
  const isReport  = selectedDomain === 'report-builder'
  const isDomain  = (id) => selectedDomain === id

  const [hovered, setHovered] = useState(null)

  function navBtn({ id, icon, label, active, onClick, indent = false, teal = false }) {
    const isHovered = hovered === id
    return (
      <button
        key={id}
        type="button"
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: indent ? '7px 14px 7px 34px' : '8px 14px',
          border: 'none', borderLeft: `3px solid ${active ? '#1B365D' : 'transparent'}`,
          background: teal
            ? (active || isHovered) ? 'rgba(27,54,93,0.08)' : 'rgba(27,54,93,0.04)'
            : active ? 'rgba(27,54,93,0.10)' : isHovered ? '#F0F2F5' : 'transparent',
          color: teal ? '#1B365D' : active ? '#1B365D' : '#334155',
          fontSize: indent ? '0.78rem' : '0.83rem',
          fontWeight: active ? 600 : teal ? 600 : 400,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
      >
        {!indent && <i className={`ti ${icon}`} style={{ fontSize: '1rem', flexShrink: 0, color: teal ? '#1B365D' : active ? '#1B365D' : '#94a3b8', lineHeight: 1 }} />}
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    )
  }

  function expanderBtn({ id, icon, label, open, onToggle, active }) {
    const isHovered = hovered === id
    return (
      <button
        type="button"
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '8px 14px',
          border: 'none', borderLeft: `3px solid ${active ? '#1B365D' : 'transparent'}`,
          background: active ? 'rgba(27,54,93,0.10)' : isHovered ? '#F0F2F5' : 'transparent',
          color: active ? '#1B365D' : '#334155',
          fontSize: '0.83rem', fontWeight: active ? 600 : 400,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: '1rem', flexShrink: 0, color: active ? '#1B365D' : '#94a3b8', lineHeight: 1 }} />
        <span style={{ flex: 1 }}>{label}</span>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`}
           style={{ fontSize: '0.7rem', color: '#b0bec5', lineHeight: 1 }} />
      </button>
    )
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid #E2E8F0',
      background: '#F0F2F5',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo area */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '0.5px solid #e2e8f0', flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A202C', lineHeight: 1.3 }}>
          {schoolName || 'Inclusion Dashboard'}
        </p>
        {schoolName && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Inclusion Dashboard</p>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 6 }}>
        {/* Home */}
        {navBtn({ id: 'home', icon: 'ti-home', label: 'Home', active: isHome,
          onClick: () => { setSelectedDomain(''); setOverviewMode('domain'); setSelectedCategory(null); onClose() } })}

        {/* Domains — clicking the label navigates straight to the domain overview page and opens the submenu */}
        {expanderBtn({
          id: 'domains-expander', icon: 'ti-layout-grid', label: 'Domains',
          open: activeSidebarSection === 'domains',
          onToggle: () => { setSelectedDomain('__domains__'); setActiveSidebarSection('domains'); onClose() },
          active: selectedDomain === '__domains__',
        })}
        {activeSidebarSection === 'domains' && domains.map(d => {
          const colour = sidebarDomainColour(d.name)
          const active = isDomain(d.id)
          const isH = hovered === `domain-${d.id}`
          return (
            <button key={d.id} type="button"
              onMouseEnter={() => setHovered(`domain-${d.id}`)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { setSelectedDomain(d.id); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 14px 7px 34px',
                border: 'none', borderLeft: `3px solid ${active ? '#1B365D' : 'transparent'}`,
                background: active ? 'rgba(27,54,93,0.10)' : isH ? '#F0F2F5' : 'transparent',
                color: active ? '#1B365D' : '#334155',
                fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }} />
              {d.name}
            </button>
          )
        })}

        {/* Categories */}
        {expanderBtn({
          id: 'cats-expander', icon: 'ti-tag', label: 'Categories',
          open: activeSidebarSection === 'categories', onToggle: () => setActiveSidebarSection(prev => prev === 'categories' ? null : 'categories'),
          active: !selectedDomain && overviewMode === 'category',
        })}
        {activeSidebarSection === 'categories' && PROVISION_POINT_CATEGORIES.map(cat => {
          const active = !selectedDomain && overviewMode === 'category' && selectedCategory === cat
          const isH = hovered === `cat-${cat}`
          return (
            <button key={cat} type="button"
              onMouseEnter={() => setHovered(`cat-${cat}`)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { setSelectedDomain(''); setOverviewMode('category'); setSelectedCategory(cat); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 14px 7px 34px',
                border: 'none', borderLeft: `3px solid ${active ? '#1B365D' : 'transparent'}`,
                background: active ? 'rgba(27,54,93,0.10)' : isH ? '#F0F2F5' : 'transparent',
                color: active ? '#1B365D' : '#334155',
                fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}>
              {cat}
            </button>
          )
        })}

        {/* Barriers */}
        {navBtn({
          id: 'barriers', icon: 'ti-alert-triangle',
          label: 'Barriers',
          active: selectedDomain === 'barriers',
          onClick: () => { setSelectedDomain('barriers'); onClose() },
        })}

        {/* Create Inclusion Strategy */}
        {navBtn({
          id: 'inclusion-strategy', icon: 'ti-clipboard-text',
          label: 'Create Inclusion Strategy',
          active: selectedDomain === 'inclusion-strategy',
          onClick: () => { setSelectedDomain('inclusion-strategy'); onClose() },
        })}

        {/* Divider */}
        <div style={{ height: '0.5px', background: '#e2e8f0', margin: '6px 0' }} />

        {/* Team — approver and mat_admin only */}
        {(userRole === 'approver' || userRole === 'mat_admin') && (
          <div className={flashTeam ? 'sidebar-team-flash' : undefined}
               onAnimationEnd={onFlashTeamEnd}>
            {navBtn({
              id: 'team', icon: 'ti-users',
              label: 'Team',
              active: selectedDomain === 'team',
              onClick: () => { setSelectedDomain('team'); onClose() },
            })}
          </div>
        )}

        {/* Generate Report */}
        {navBtn({
          id: 'generate-report', icon: 'ti-file-export',
          label: 'Generate Report',
          active: isReport, teal: true,
          onClick: () => { onGenerateReport(); onClose() },
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '0.5px solid #e2e8f0', padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-circle-check" style={{ fontSize: '0.8rem', color: '#257A3B' }} />
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {answered} of {totalPP} recorded
          </span>
        </div>
      </div>
    </aside>
  )
}

// ── ReportBuilder shared mini-components ─────────────────────────────
function RBIconBox({ bg, color, icon }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <i className={`ti ${icon}`} style={{ color, fontSize: '1rem', lineHeight: 1 }} />
    </div>
  )
}
function RBBadge({ text, included }) {
  const always = included === undefined
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap',
      background: always || included ? 'rgba(27,54,93,0.10)' : '#f1f5f9',
      color:      always || included ? '#1B365D' : '#64748b',
    }}>{text}</span>
  )
}
function RBToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: value ? '#1B365D' : '#cbd5e1', position: 'relative',
      transition: 'background 0.2s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  )
}
function RBChartToggle({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: '#E2E8F0', borderRadius: 6, padding: 3, alignSelf: 'flex-start' }}>
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
          padding: '4px 11px', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
          background: value === opt.value ? '#fff' : 'transparent',
          color:      value === opt.value ? '#1A202C' : '#64748b',
          fontWeight: value === opt.value ? 600 : 400,
          boxShadow:  value === opt.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        }}>{opt.label}</button>
      ))}
    </div>
  )
}

// Domain UUIDs from SCHEMA_REFERENCE.md (verified 28 June 2026)
const REPORT_DOMAIN_OPTIONS = [
  { id: '11111111-0000-0000-0000-000000000001', label: 'SEND Support & Needs' },
  { id: '11111111-0000-0000-0000-000000000002', label: 'Equity & Disadvantage' },
  { id: '11111111-0000-0000-0000-000000000003', label: 'Attendance & Engagement' },
  { id: '11111111-0000-0000-0000-000000000004', label: 'Enrichment' },
  { id: '11111111-0000-0000-0000-000000000005', label: 'Belonging' },
  { id: '11111111-0000-0000-0000-000000000006', label: 'Wellbeing' },
]
const REPORT_GROUP_OPTIONS = ['Pupil Premium', 'SEND', 'FSM', 'EAL', 'LAC', 'White Working Class', 'Social Care', 'Young Carer', 'Mental Health Support']
const REPORT_PURPOSE_OPTIONS = [
  {
    id: 'full_strategy',
    icon: 'ti-certificate',
    title: 'Full Strategy Statement',
    desc: 'All sections. For governors, Ofsted, or website publication.',
  },
  {
    id: 'domain_focus',
    icon: 'ti-layout-columns',
    title: 'Domain Focus',
    desc: 'Scoped to one or more domains. For a SEND, attendance, or equity meeting.',
  },
  {
    id: 'compliance_snapshot',
    icon: 'ti-report-analytics',
    title: 'Compliance Snapshot',
    desc: 'Readiness, gaps, and upcoming reviews only. For a quick briefing.',
  },
  {
    id: 'outcomes_summary',
    icon: 'ti-target',
    title: 'Outcomes Summary',
    desc: "Barriers and impact evidence only. For reviewing what's working.",
  },
]

function ReportBuilder({ schoolName = '', supabase: sb, school, schoolCtx = {}, onCreateInclusionStrategy }) {
  const [purpose,         setPurpose]         = useState('full_strategy')
  const [selectedDomains, setSelectedDomains] = useState([])   // empty = all domains
  const [selectedGroups,  setSelectedGroups]  = useState([])   // empty = all groups
  const [provisionView,   setProvisionView]   = useState('domain')
  const [includeAppendixB, setIncludeAppendixB] = useState(false)
  const [exportFormat,    setExportFormat]    = useState('pdf')   // 'pdf' | 'word'
  const [generating,      setGenerating]      = useState(false)
  const [genError,        setGenError]        = useState(null)

  function toggleDomain(id) {
    setSelectedDomains(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleGroup(g) {
    setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const showProvisionToggle = purpose === 'full_strategy' || purpose === 'domain_focus'
  const showAppendixB       = purpose === 'full_strategy'

  // Domain Focus requires at least one domain selected
  const generateEnabled = !(purpose === 'domain_focus' && selectedDomains.length === 0)

  // Filter summary line shown beneath controls
  const purposeLabel  = REPORT_PURPOSE_OPTIONS.find(p => p.id === purpose)?.title ?? purpose
  const domainLabel   = selectedDomains.length === 0
    ? 'All domains'
    : REPORT_DOMAIN_OPTIONS.filter(d => selectedDomains.includes(d.id)).map(d => d.label).join(', ')
  const groupLabel    = selectedGroups.length === 0 ? 'All groups' : selectedGroups.join(' + ')
  const filterSummary = `${purposeLabel} · ${domainLabel} · ${groupLabel}`

  async function handleGenerate() {
    if (!sb || !school) {
      setGenError('School data not available. Please reload and try again.')
      return
    }
    if (!generateEnabled) {
      setGenError('Please select at least one domain for Domain Focus.')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const userRes  = await sb.auth.getUser()
      const userId   = userRes.data?.user?.id

      const [entriesRes, domainsRes, barriersRes, profileRes] = await Promise.all([
        sb.from('entries')
          .select(`
            id, provision_point_id, status,
            provision_points(
              id, label, principle, universal_or_targeted, display_order, active,
              sub_domains(id, name, display_order, domain_id, domains(id, name, display_order))
            ),
            evidence_entries(
              id, entry_id, intended_outcomes, impact_on_outcomes, next_review_due,
              funding_source, cost, grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc,
              grp_social_care, grp_young_carer, grp_mental_health_support
            )
          `)
          .eq('school_id', school),
        // sub_domains(provision_points(id)) — full catalogue count per domain, same source as
        // the homepage/Domains index page's ppDomainMap, so Domain Readiness's denominator
        // isn't just the touched-only entries count (see getReadinessData in generateReport.js).
        sb.from('domains').select('id, name, display_order, sub_domains(provision_points(id))').order('display_order'),
        sb.from('barriers')
          .select('id, description, status, actions, scale, student_groups, domain_id, sub_domain_id, next_review_due, domains(name), sub_domains(name)')
          .eq('school_id', school),
        userId
          ? sb.from('profiles').select('first_name, last_name, job_title').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (entriesRes.error) throw new Error(`Entries: ${entriesRes.error.message}`)
      if (domainsRes.error) throw new Error(`Domains: ${domainsRes.error.message}`)

      const reportArgs = {
        purpose,
        selectedDomains,
        selectedGroups,
        provisionView,
        includeAppendixB,
        entries:     entriesRes.data  ?? [],
        domains:     domainsRes.data  ?? [],
        barriers:    barriersRes.data ?? [],
        schoolCtx,
        schoolName,
        userProfile: profileRes.data  ?? null,
      }

      if (exportFormat === 'word') {
        await generateEvidenceReportWord(reportArgs)
      } else {
        generateEvidenceReport(reportArgs)
      }
    } catch (err) {
      console.error('[ReportBuilder] generation error:', err)
      setGenError('Could not generate report — check console for details.')
    }
    setGenerating(false)
  }

  const card     = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 12 }
  const cardHead = { fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const pill     = (active) => ({
    padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
    border: `1.5px solid ${active ? '#1B365D' : '#e2e8f0'}`,
    background: active ? 'rgba(27,54,93,0.10)' : '#fff',
    color:      active ? '#1B365D' : '#64748b',
    fontSize: '0.78rem', fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Generate Report</h1>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
          Choose a purpose, scope by domain and student group, then generate your PDF.
        </p>
      </div>

      <div style={{ flex: 1, paddingBottom: 100 }}>

        {/* Secondary entry point — Create Inclusion Strategy wizard */}
        {onCreateInclusionStrategy && (
          <button type="button" onClick={onCreateInclusionStrategy} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            padding: '13px 15px', marginBottom: 12, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            border: '1.5px dashed #1B365D', background: 'rgba(27,54,93,0.04)',
          }}>
            <i className="ti ti-clipboard-text" style={{ color: '#1B365D', fontSize: '1.1rem', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, color: '#1B365D' }}>
                New: draft your full Inclusion Strategy statement
              </span>
              <span style={{ display: 'block', fontSize: '0.73rem', color: '#64748b', marginTop: 2 }}>
                A guided, step-by-step builder — separate from the report exports below.
              </span>
            </span>
            <i className="ti ti-arrow-right" style={{ color: '#1B365D', fontSize: '0.9rem', flexShrink: 0 }} />
          </button>
        )}

        {/* Filter 1 — Report Purpose */}
        <div style={card}>
          <p style={cardHead}>Report Purpose</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {REPORT_PURPOSE_OPTIONS.map(opt => {
              const active = purpose === opt.id
              return (
                <button key={opt.id} type="button" onClick={() => setPurpose(opt.id)} style={{
                  textAlign: 'left', padding: '13px 15px',
                  border: `2px solid ${active ? '#1B365D' : '#e2e8f0'}`,
                  borderRadius: 10, cursor: 'pointer',
                  background: active ? 'rgba(27,54,93,0.05)' : '#fff',
                  fontFamily: 'inherit', transition: 'border-color 0.12s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <i className={`ti ${opt.icon}`} style={{ color: active ? '#1B365D' : '#94a3b8', fontSize: '1rem' }} />
                    <span style={{ fontSize: '0.83rem', fontWeight: 700, color: active ? '#1B365D' : '#1A202C' }}>{opt.title}</span>
                    {active && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 600, background: '#1B365D', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                        Selected
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.73rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Filter 2 — Domain Scope */}
        <div style={card}>
          <p style={cardHead}>Domain Scope</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button"
              onClick={() => setSelectedDomains([])}
              style={pill(selectedDomains.length === 0)}>
              All domains
            </button>
            {REPORT_DOMAIN_OPTIONS.map(d => (
              <button key={d.id} type="button"
                onClick={() => toggleDomain(d.id)}
                style={pill(selectedDomains.includes(d.id))}>
                {d.label}
              </button>
            ))}
          </div>
          {purpose === 'domain_focus' && selectedDomains.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: '#D4751A', marginTop: 8 }}>
              Domain Focus requires at least one domain selected.
            </p>
          )}
        </div>

        {/* Filter 3 — Student Group */}
        <div style={card}>
          <p style={cardHead}>Student Group</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button"
              onClick={() => setSelectedGroups([])}
              style={pill(selectedGroups.length === 0)}>
              All groups
            </button>
            {REPORT_GROUP_OPTIONS.map(g => (
              <button key={g} type="button"
                onClick={() => toggleGroup(g)}
                style={pill(selectedGroups.includes(g))}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Provision view toggle — Full Strategy or Domain Focus only */}
        {showProvisionToggle && (
          <div style={card}>
            <p style={cardHead}>Organise Provision By</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'domain',    label: 'Domain' },
                { id: 'principle', label: 'DfE Principle' },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => setProvisionView(opt.id)}
                  style={pill(provisionView === opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 8 }}>
              Controls how provision points are organised in Section 5.
            </p>
          </div>
        )}

        {/* Appendix B toggle — Full Strategy only */}
        {showAppendixB && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <RBToggle value={includeAppendixB} onChange={setIncludeAppendixB} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                  Appendix B: Full Provision Checklist
                </p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                  All active provision points with status, organised by domain and sub-domain.
                  Off by default — adds significant length to the report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter summary */}
        <div style={{ background: '#F0F2F5', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <i className="ti ti-filter" style={{ color: '#1B365D', fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>{filterSummary}</p>
        </div>

      </div>

      {/* Sticky generate bar */}
      <div style={{
        position: 'sticky', bottom: 0, background: '#fff',
        borderTop: '1px solid #e2e8f0', padding: '12px 0',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {genError && (
          <p style={{ fontSize: '0.78rem', color: '#dc2626', margin: 0 }}>{genError}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.78rem', color: '#64748b', flex: 1, minWidth: 0 }}>
            {purpose === 'full_strategy' ? 'Inclusion Strategy Statement' : 'Inclusion Evidence Report'}
            {' — '}
            {domainLabel}
            {selectedGroups.length > 0 ? ` · ${groupLabel}` : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
              {[
                { id: 'pdf',  label: 'PDF' },
                { id: 'word', label: 'Word' },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => setExportFormat(opt.id)}
                  style={{
                    padding: '7px 13px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.78rem', fontWeight: exportFormat === opt.id ? 600 : 400,
                    background: exportFormat === opt.id ? '#1B365D' : '#fff',
                    color:      exportFormat === opt.id ? '#fff'    : '#64748b',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleGenerate} disabled={generating || !generateEnabled} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: (generating || !generateEnabled) ? '#94a3b8' : '#1B365D',
              color: '#fff', fontSize: '0.85rem', fontWeight: 600,
              cursor: (generating || !generateEnabled) ? 'default' : 'pointer',
              flexShrink: 0, fontFamily: 'inherit',
            }}>
              <i className="ti ti-download" style={{ fontSize: '0.9rem', lineHeight: 1 }} />
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Barriers constants ────────────────────────────────────────────────
const BARRIER_GROUPS = [
  { key: 'send', label: 'SEND' },
  { key: 'pp',   label: 'Pupil Premium' },
  { key: 'eal',  label: 'EAL' },
  { key: 'fsm',  label: 'FSM' },
  { key: 'lac',  label: 'LAC' },
  { key: 'wwc',  label: 'White Working Class' },
  { key: 'social_care',            label: 'Social Care' },
  { key: 'young_carer',            label: 'Young Carer' },
  { key: 'mental_health_support',  label: 'Mental Health Support' },
  { key: 'other',label: 'Other' },
]
const BARRIER_SCALES = [
  { value: 'individual',   label: 'Individual' },
  { value: 'group',        label: 'Group' },
  { value: 'whole_school', label: 'Whole school' },
]
const BARRIER_SOURCES = [
  { value: 'data_analysis',    label: 'Data analysis' },
  { value: 'staff_observation',label: 'Staff observation' },
  { value: 'pupil_voice',      label: 'Pupil voice' },
  { value: 'family_feedback',  label: 'Family feedback' },
  { value: 'external_review',  label: 'External review' },
]
const BARRIER_STATUSES = [
  { value: 'active',           label: 'Active' },
  { value: 'being_addressed',  label: 'Being addressed' },
  { value: 'resolved',         label: 'Resolved' },
]
const BARRIER_STATUS_STYLE = {
  active:          { bg: 'rgba(234,67,53,0.10)',  color: '#EA4335' },
  being_addressed: { bg: 'rgba(212,117,26,0.12)', color: '#D4751A' },
  resolved:        { bg: 'rgba(37,122,59,0.10)',  color: '#257A3B' },
}

function BarriersView({ school, supabase: sb, domains: domainList, readOnly = false }) {
  const [barriers,      setBarriers]      = useState([])
  const [subDomainMap,  setSubDomainMap]  = useState({})  // domainId → [{id,name}]
  const [allEntries,    setAllEntries]    = useState([])  // for linking provision points
  const [bLoading,      setBLoading]      = useState(true)
  const [expandedLinks, setExpandedLinks] = useState(new Set())

  // Filters
  const [filterDomain, setFilterDomain]  = useState('')
  const [filterStatus, setFilterStatus]  = useState('')
  const [filterGroup,  setFilterGroup]   = useState('')

  // Modal
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editBarrier, setEditBarrier] = useState(null)  // null = add, else barrier row
  const [form,        setForm]        = useState({})
  const [formErrors,  setFormErrors]  = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState(null)
  const [deleting,    setDeleting]    = useState(false)

  // Modal sub-state
  const [modalSubDomains, setModalSubDomains] = useState([])
  const [linkSearch,      setLinkSearch]      = useState('')
  const [selectedLinks,   setSelectedLinks]   = useState(new Set())  // entry_id set

  // ── Fetch barriers + sub_domains + all entries ─────────────────────
  useEffect(() => {
    if (!school) return
    setBLoading(true)
    Promise.all([
      sb.from('barriers')
        .select(`
          id, description, domain_id, sub_domain_id, student_groups, scale, source,
          status, actions, date_identified, next_review_due, created_at,
          domains(id, name),
          sub_domains(id, name),
          barrier_provision_links(id, entry_id, entries(provision_point_id, provision_points(id, label, active)))
        `)
        .order('created_at', { ascending: false }),
      sb.from('sub_domains').select('id, name, domain_id').order('name'),
      sb.from('entries')
        .select('id, provision_point_id, status, provision_points(id, label, active, sub_domains(name, domains(name)))')
        .eq('school_id', school),
    ]).then(([bRes, sdRes, eRes]) => {
      if (bRes.error) console.error('Barriers fetch error:', bRes.error)
      setBarriers(bRes.data ?? [])
      const sdByDomain = {}
      for (const sd of sdRes.data ?? []) {
        ;(sdByDomain[sd.domain_id] = sdByDomain[sd.domain_id] ?? []).push(sd)
      }
      setSubDomainMap(sdByDomain)
      setAllEntries((eRes.data ?? []).filter(e => e.provision_points?.active !== false))
      setBLoading(false)
    })
  }, [school])

  function refresh() {
    sb.from('barriers')
      .select(`
        id, description, domain_id, sub_domain_id, student_groups, scale, source,
        status, actions, date_identified, next_review_due, created_at,
        domains(id, name),
        sub_domains(id, name),
        barrier_provision_links(id, entry_id, entries(provision_point_id, provision_points(id, label, active)))
      `)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBarriers(data ?? []))
  }

  // ── Filter application ─────────────────────────────────────────────
  const filtered = barriers.filter(b => {
    if (filterDomain && b.domain_id !== filterDomain) return false
    if (filterStatus && b.status !== filterStatus) return false
    if (filterGroup  && !b.student_groups?.[filterGroup]) return false
    return true
  })

  // ── Modal helpers ──────────────────────────────────────────────────
  function openAdd() {
    setEditBarrier(null)
    setForm({ status: 'active', scale: 'group', student_groups: {} })
    setFormErrors({})
    setSaveError(null)
    setSelectedLinks(new Set())
    setLinkSearch('')
    setModalSubDomains([])
    setModalOpen(true)
  }

  function openEdit(b) {
    setEditBarrier(b)
    setForm({
      description:    b.description ?? '',
      domain_id:      b.domain_id ?? '',
      sub_domain_id:  b.sub_domain_id ?? '',
      student_groups: b.student_groups ?? {},
      scale:          b.scale ?? 'group',
      source:         b.source ?? '',
      status:         b.status ?? 'active',
      actions:        b.actions ?? '',
      date_identified:b.date_identified ?? '',
      next_review_due:b.next_review_due ?? '',
    })
    setFormErrors({})
    setSaveError(null)
    const existingLinks = new Set((b.barrier_provision_links ?? []).map(l => l.entry_id))
    setSelectedLinks(existingLinks)
    setLinkSearch('')
    setModalSubDomains(subDomainMap[b.domain_id] ?? [])
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditBarrier(null); setForm({}) }

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }))
    setFormErrors(prev => ({ ...prev, [k]: undefined }))
  }

  function onDomainChange(domainId) {
    setField('domain_id', domainId)
    setField('sub_domain_id', '')
    setModalSubDomains(subDomainMap[domainId] ?? [])
  }

  function toggleGroup(key) {
    setForm(prev => ({
      ...prev,
      student_groups: { ...(prev.student_groups ?? {}), [key]: !(prev.student_groups ?? {})[key] },
    }))
  }

  function toggleLink(entryId) {
    setSelectedLinks(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  async function handleSave() {
    if (readOnly) return
    const errors = {}
    if (!form.description?.trim()) errors.description = 'Description is required'
    if (!form.domain_id) errors.domain_id = 'Domain is required'
    if (Object.keys(errors).length) { setFormErrors(errors); return }

    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        description:    form.description.trim(),
        domain_id:      form.domain_id,
        sub_domain_id:  form.sub_domain_id || null,
        student_groups: form.student_groups ?? {},
        scale:          form.scale || null,
        source:         form.source || null,
        status:         form.status || 'active',
        actions:        form.actions?.trim() || null,
        date_identified:form.date_identified || null,
        next_review_due:form.next_review_due || null,
      }

      let barrierId
      if (editBarrier) {
        const { error } = await sb.from('barriers').update(payload).eq('id', editBarrier.id)
        if (error) throw error
        barrierId = editBarrier.id
      } else {
        const { data, error } = await sb.from('barriers').insert({ ...payload, school_id: school }).select('id').single()
        if (error) throw error
        barrierId = data.id
      }

      // Sync links: delete all then reinsert selected
      await sb.from('barrier_provision_links').delete().eq('barrier_id', barrierId)
      if (selectedLinks.size > 0) {
        const linkRows = [...selectedLinks].map(entry_id => ({ barrier_id: barrierId, entry_id }))
        const { error } = await sb.from('barrier_provision_links').insert(linkRows)
        if (error) throw error
      }

      closeModal()
      refresh()
    } catch (err) {
      console.error('Barrier save error:', err)
      setSaveError('Could not save — please try again.')
    }
    setSaving(false)
  }

  async function handleDelete(barrier) {
    if (readOnly) return
    if (!window.confirm('Delete this barrier? This cannot be undone.')) return
    setDeleting(true)
    await sb.from('barriers').delete().eq('id', barrier.id)
    setDeleting(false)
    refresh()
  }

  // ── Linked provision points display ────────────────────────────────
  function LinkedPoints({ barrier }) {
    const links = barrier.barrier_provision_links ?? []
    if (links.length === 0) return (
      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>No provision points linked</span>
    )
    const isExpanded = expandedLinks.has(barrier.id)
    return (
      <div>
        <button type="button"
          onClick={() => setExpandedLinks(prev => {
            const next = new Set(prev)
            if (next.has(barrier.id)) next.delete(barrier.id)
            else next.add(barrier.id)
            return next
          })}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                   fontSize: '0.75rem', color: '#1B365D', fontWeight: 500 }}>
          {links.length} provision point{links.length !== 1 ? 's' : ''} linked
          <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`}
             style={{ fontSize: '0.65rem', marginLeft: 4 }} />
        </button>
        {isExpanded && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {links.map(l => {
              const pp = l.entries?.provision_points
              if (!pp) return null
              return (
                <div key={l.id} style={{ fontSize: '0.73rem', color: '#475569',
                  padding: '3px 8px', background: '#F7F8FA', borderRadius: 5, display: 'inline-block' }}>
                  {pp.label}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Provision point link multi-select ──────────────────────────────
  const groupedEntries = (() => {
    const grouped = {}
    for (const e of allEntries) {
      const domainName = e.provision_points?.sub_domains?.domains?.name ?? 'Other'
      const subName    = e.provision_points?.sub_domains?.name ?? ''
      const key = `${domainName}||${subName}`
      ;(grouped[key] = grouped[key] ?? { domainName, subName, entries: [] }).entries.push(e)
    }
    return Object.values(grouped).sort((a, b) => a.domainName.localeCompare(b.domainName) || a.subName.localeCompare(b.subName))
  })()

  const linkSearchLower = linkSearch.toLowerCase()
  const filteredGroups = groupedEntries.map(g => ({
    ...g,
    entries: g.entries.filter(e =>
      !linkSearchLower || (e.provision_points?.label ?? '').toLowerCase().includes(linkSearchLower)
    ),
  })).filter(g => g.entries.length > 0)

  // ── Segmented control helper ───────────────────────────────────────
  function SegCtrl({ options, value, onChange, small }) {
    return (
      <div style={{ display: 'flex', gap: 3, background: '#E2E8F0', borderRadius: 7, padding: 3, alignSelf: 'flex-start' }}>
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
            padding: small ? '4px 10px' : '5px 14px', border: 'none', borderRadius: 5,
            fontSize: small ? '0.73rem' : '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: value === opt.value ? 600 : 400,
            color:      value === opt.value ? '#1A202C' : '#64748b',
            background: value === opt.value ? '#fff' : 'transparent',
            boxShadow:  value === opt.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.12s', whiteSpace: 'nowrap',
          }}>{opt.label}</button>
        ))}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────
  const lf = { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }
  const lbl = { fontSize: '0.78rem', fontWeight: 600, color: '#374151' }
  const inp = { padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 7,
                fontSize: '0.83rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const errStyle = { fontSize: '0.72rem', color: '#DC2626', marginTop: 2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A202C', marginBottom: 4 }}>
            Barriers to Learning &amp; Participation
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9CA3AF', lineHeight: 1.5, maxWidth: 520 }}>
            Identify and track barriers affecting your pupils. Link each barrier to the provision you have in place to address it.
          </p>
        </div>
        {!readOnly && (
          <button type="button" onClick={openAdd} style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: '#1B365D', color: '#fff',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <i className="ti ti-plus" style={{ fontSize: '0.9rem' }} />
            Add Barrier
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Domain */}
        <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
          style={{ ...inp, width: 'auto', minWidth: 160 }}>
          <option value="">All domains</option>
          {domainList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ value: '', label: 'All' }, ...BARRIER_STATUSES].map(s => {
            const active = filterStatus === s.value
            return (
              <button key={s.value} type="button" onClick={() => setFilterStatus(s.value)} style={{
                padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${active ? '#1B365D' : '#E2E8F0'}`,
                background: active ? 'rgba(27,54,93,0.08)' : '#fff',
                color: active ? '#1B365D' : '#64748b', fontSize: '0.78rem',
                fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
              }}>{s.label}</button>
            )
          })}
        </div>

        {/* Group */}
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          style={{ ...inp, width: 'auto', minWidth: 160 }}>
          <option value="">All groups</option>
          {BARRIER_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>

      {/* Barrier list */}
      {bLoading ? (
        <p className="state-msg">Loading barriers…</p>
      ) : barriers.length === 0 ? (
        <ACard>
          <p style={{ color: '#1a1a2e', fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>
            No barriers identified yet.
          </p>
          <p style={{ color: '#9CA3AF', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 12 }}>
            The EEF recommends starting implementation by identifying commonly occurring barriers to learning across your cohort — before designing provision. This is Step 1 in building your Inclusion Strategy.
          </p>
          <a
            href="https://www.gov.uk/guidance/developing-an-inclusion-strategy-using-the-inclusive-mainstream-fund"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.85rem', color: '#1B365D' }}
          >
            See the DfE's guidance on identifying barriers →
          </a>
        </ACard>
      ) : filtered.length === 0 ? (
        <ACard>
          <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>No barriers match the current filters.</p>
        </ACard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => {
            const domainColour = b.domains?.name ? aDomainColour(b.domains.name) : '#94a3b8'
            const statusStyle  = BARRIER_STATUS_STYLE[b.status] ?? BARRIER_STATUS_STYLE.active
            const activeGroups = BARRIER_GROUPS.filter(g => b.student_groups?.[g.key])
            const scaleLabel   = BARRIER_SCALES.find(s => s.value === b.scale)?.label
            const sourceLabel  = BARRIER_SOURCES.find(s => s.value === b.source)?.label

            return (
              <div key={b.id} style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                borderLeft: `4px solid ${domainColour}`, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Domain / sub-domain header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: domainColour }}>
                      {b.domains?.name ?? '—'}
                    </span>
                    {b.sub_domains?.name && (
                      <>
                        <span style={{ fontSize: '0.7rem', color: '#CBD5E1' }}>›</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.sub_domains.name}</span>
                      </>
                    )}
                    {/* Status badge — right-aligned */}
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
                      padding: '2px 9px', borderRadius: 20,
                      background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                      {BARRIER_STATUSES.find(s => s.value === b.status)?.label ?? b.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '0.85rem', color: '#1A202C', lineHeight: 1.55, margin: 0 }}>
                    {b.description}
                  </p>

                  {/* Group tags */}
                  {activeGroups.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {activeGroups.map(g => (
                        <AGroupPill key={g.key} label={g.label} />
                      ))}
                    </div>
                  )}

                  {/* Scale + Source badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {scaleLabel && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                        background: '#EFF6FF', color: '#1E40AF' }}>{scaleLabel}</span>
                    )}
                    {sourceLabel && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                        background: '#F5F3FF', color: '#5B21B6' }}>{sourceLabel}</span>
                    )}
                  </div>

                  {/* Linked provision points + review date row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <LinkedPoints barrier={b} />
                    {b.next_review_due && (
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        E&amp;S due: {new Date(b.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Actions row */}
                  {!readOnly && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button type="button" onClick={() => openEdit(b)} style={{
                        padding: '5px 12px', border: '1px solid #E2E8F0', borderRadius: 6,
                        background: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
                      }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(b)} disabled={deleting} style={{
                        padding: '5px 12px', border: '1px solid #FCA5A5', borderRadius: 6,
                        background: '#FEF2F2', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626',
                      }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680,
            maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 24px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A202C' }}>
                {editBarrier ? 'Edit Barrier' : 'Add Barrier'}
              </h2>
              <button type="button" onClick={closeModal} style={{
                background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer',
                color: '#94a3b8', lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', flex: 1 }}>

              {/* Description */}
              <div style={lf}>
                <label style={lbl}>Barrier description <span style={{ color: '#DC2626' }}>*</span></label>
                <textarea rows={3} value={form.description ?? ''} onChange={e => setField('description', e.target.value)}
                  placeholder="Describe the barrier to learning or participation you have identified"
                  style={{ ...inp, resize: 'vertical' }} />
                {formErrors.description && <span style={errStyle}>{formErrors.description}</span>}
              </div>

              {/* Domain + Sub-domain */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={lbl}>Domain <span style={{ color: '#DC2626' }}>*</span></label>
                  <select value={form.domain_id ?? ''} onChange={e => onDomainChange(e.target.value)} style={inp}>
                    <option value="">Select domain…</option>
                    {domainList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {formErrors.domain_id && <span style={errStyle}>{formErrors.domain_id}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={lbl}>Sub-domain (optional)</label>
                  <select value={form.sub_domain_id ?? ''} onChange={e => setField('sub_domain_id', e.target.value)}
                    style={inp} disabled={!form.domain_id}>
                    <option value="">No sub-domain</option>
                    {modalSubDomains.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Student groups */}
              <div style={lf}>
                <label style={lbl}>Student groups affected</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BARRIER_GROUPS.map(g => {
                    const checked = !!(form.student_groups ?? {})[g.key]
                    return (
                      <label key={g.key} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 11px', borderRadius: 20,
                        border: `1.5px solid ${checked ? '#1B365D' : '#E2E8F0'}`,
                        background: checked ? 'rgba(27,54,93,0.07)' : '#fff',
                        cursor: 'pointer', fontSize: '0.78rem', color: checked ? '#1B365D' : '#374151',
                        fontWeight: checked ? 600 : 400, userSelect: 'none',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.key)}
                          style={{ display: 'none' }} />
                        {g.label}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Scale */}
              <div style={lf}>
                <label style={lbl}>Scale</label>
                <SegCtrl options={BARRIER_SCALES} value={form.scale ?? 'group'} onChange={v => setField('scale', v)} />
              </div>

              {/* Source */}
              <div style={lf}>
                <label style={lbl}>Source of identification</label>
                <select value={form.source ?? ''} onChange={e => setField('source', e.target.value)} style={{ ...inp }}>
                  <option value="">Select source…</option>
                  {BARRIER_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Status */}
              <div style={lf}>
                <label style={lbl}>Status</label>
                <SegCtrl options={BARRIER_STATUSES} value={form.status ?? 'active'} onChange={v => setField('status', v)} />
              </div>

              {/* Actions */}
              <div style={lf}>
                <label style={lbl}>Actions being taken (optional)</label>
                <textarea rows={2} value={form.actions ?? ''} onChange={e => setField('actions', e.target.value)}
                  placeholder="Describe what is currently being done to address this barrier"
                  style={{ ...inp, resize: 'vertical' }} />
              </div>

              {/* Linked provision points */}
              <div style={{ ...lf, marginBottom: 14 }}>
                <label style={lbl}>Linked provision points</label>
                <p style={{ fontSize: '0.73rem', color: '#9CA3AF', marginBottom: 6 }}>
                  Select the provision points that address this barrier.
                </p>
                <input type="text" placeholder="Search provision points…"
                  value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                  style={{ ...inp, marginBottom: 8 }} />
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 240, overflowY: 'auto' }}>
                  {filteredGroups.length === 0 ? (
                    <p style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '0.8rem' }}>No provision points found.</p>
                  ) : filteredGroups.map((g, gi) => (
                    <div key={gi}>
                      <div style={{ padding: '7px 12px', background: '#F7F8FA',
                        borderBottom: '1px solid #E2E8F0', fontSize: '0.72rem',
                        fontWeight: 600, color: '#374151', position: 'sticky', top: 0 }}>
                        {g.domainName}{g.subName ? ` › ${g.subName}` : ''}
                      </div>
                      {g.entries.map(e => {
                        const checked = selectedLinks.has(e.id)
                        const ppStatus = e.status
                        const statusStyle = ppStatus === 'in_place' ? { color: '#257A3B', bg: 'rgba(37,122,59,0.10)' }
                          : ppStatus === 'in_progress' ? { color: '#D4751A', bg: 'rgba(212,117,26,0.10)' }
                          : { color: '#94a3b8', bg: '#F1F5F9' }
                        return (
                          <label key={e.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 14px', cursor: 'pointer',
                            background: checked ? 'rgba(27,54,93,0.04)' : '#fff',
                            borderBottom: '0.5px solid #F1F5F9',
                          }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleLink(e.id)}
                              style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: '0.8rem', color: '#1A202C' }}>
                              {e.provision_points?.label ?? 'Untitled'}
                            </span>
                            {ppStatus && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 7px',
                                borderRadius: 20, background: statusStyle.bg, color: statusStyle.color,
                                whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {STATUS_LABELS[ppStatus] ?? ppStatus}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {selectedLinks.size > 0 && (
                  <p style={{ fontSize: '0.73rem', color: '#1B365D', marginTop: 5, fontWeight: 500 }}>
                    {selectedLinks.size} point{selectedLinks.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Date fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={lbl}>Date identified (optional)</label>
                  <input type="date" value={form.date_identified ?? ''} onChange={e => setField('date_identified', e.target.value || null)}
                    style={inp} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={lbl}>Next evaluate &amp; sustain date</label>
                  <input type="date" value={form.next_review_due ?? ''} onChange={e => setField('next_review_due', e.target.value || null)}
                    style={inp} />
                </div>
              </div>

              {saveError && (
                <p style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: 10 }}>{saveError}</p>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={closeModal} style={{
                padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: 7,
                background: '#fff', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
              }}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} style={{
                padding: '8px 18px', border: 'none', borderRadius: 7,
                background: saving ? '#94a3b8' : '#1B365D', color: '#fff',
                fontSize: '0.83rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>{saving ? 'Saving…' : editBarrier ? 'Save changes' : 'Add barrier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Evidence-depth heat map for one category — relocated from the former Analytics "Provision
// Depth" tab onto that category's own drill-down page (App.jsx's category-detail branch).
// Domain-subgrouped for display only; the category itself is what scopes the data (confirmed
// in Phase 0: each of these categories cuts across all 6 domains, so it never belonged on a
// single Domain page). The completion circles that used to sit alongside this were deleted
// outright rather than relocated — their category point-count + click-through-to-category are
// both already covered by the Category index cards, which show real in_place/in_progress/
// not_in_place status counts (a different, more meaningful metric than "has any evidence").
// The domain filter pill is gone too — this page is already scoped to one category, and the
// domain subgrouping below does the same narrowing without a redundant control.
// Colour-by-evidence-count is intentionally kept as its own signal, separate from status —
// this is evidence density/thinness, not a stand-in for the status counts above, and is the
// intended basis for a future Provision Depth risk-view redesign.
// Categories with an evidence-depth heat map — 4 of the 8 PROVISION_POINT_CATEGORIES; the
// other 4 either had their own completion circle (Named Person, Policy / Published Document,
// Monitoring & Data — all deleted) or have neither (Internal Process / System — a known
// coverage gap, flagged for V1.5 review, left alone here).
const HEAT_CATEGORIES = [
  'Staff Training & CPD',
  'External Partnership',
  'Family & Community Engagement',
  'Direct Provision for Students',
]

const HEAT_DOMAIN_ORDER = [
  'SEND Support & Needs',
  'Equity & Disadvantage',
  'Attendance & Engagement',
  'Enrichment',
  'Belonging',
  'Wellbeing',
]

function heatCellColour(count) {
  if (count === 0) return '#E5E7EB'
  if (count === 1) return '#C7D9EE'
  if (count === 2) return '#8FB8D8'
  if (count <= 4)  return '#4A7FA8'
  return '#1B365D'
}

function CategoryHeatmap({ category, analyticsEntries }) {
  const catEntries = analyticsEntries.filter(e => (e.provision_points?.category ?? '') === category)
  const byDomain = {}
  catEntries.forEach(e => {
    const dn = e.provision_points?.sub_domains?.domains?.name ?? 'Unknown'
    if (!byDomain[dn]) byDomain[dn] = []
    byDomain[dn].push({
      name:   e.provision_points?.label ?? 'Unknown',
      domain: dn,
      count:  (e.evidence_entries ?? []).length,
    })
  })
  const groups = HEAT_DOMAIN_ORDER.filter(d => byDomain[d]).map(d => ({ domain: d, points: byDomain[d] }))
  const totalPoints = groups.reduce((sum, g) => sum + g.points.length, 0)

  return (
    <ACard>
      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 2 }}>Evidence depth</p>
      <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 12 }}>{totalPoints} point{totalPoints !== 1 ? 's' : ''}</p>
      {groups.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No provision points in this category.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(g => (
            <div key={g.domain}>
              <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.domain}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {g.points.map((pt, idx) => (
                  <IconTooltip key={idx} text={`${pt.name} — ${pt.count} evidence ${pt.count === 1 ? 'entry' : 'entries'}`}>
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: 4,
                        background: heatCellColour(pt.count),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'default', flexShrink: 0,
                      }}
                    >
                      {pt.count >= 5 && (
                        <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, lineHeight: 1 }}>{pt.count}</span>
                      )}
                    </div>
                  </IconTooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ACard>
  )
}

function GroupReach({ reachMatrix, schoolCtx }) {
  const CTX_COHORTS = [
    { field: 'reach_send',  cohort: schoolCtx.sendCount },
    { field: 'reach_pp',    cohort: schoolCtx.ppCount },
    { field: 'reach_eal',   cohort: schoolCtx.ealCount },
    { field: 'reach_fsm',   cohort: schoolCtx.fsmCount },
    { field: 'reach_lac',   cohort: schoolCtx.lacCount },
    { field: 'reach_wwc',   cohort: schoolCtx.wwcCount },
    { field: 'reach_social_care',           cohort: schoolCtx.socialCareCount },
    { field: 'reach_young_carer',           cohort: schoolCtx.youngCarerCount },
    { field: 'reach_mental_health_support', cohort: schoolCtx.mentalHealthSupportCount },
    { field: 'reach_other', cohort: null },
  ]
  const hasAnyData = reachMatrix.some(r => r.totalReach > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ACard>
        <ASectionTitle sub="Student group reach across all domains — enter student numbers in evidence entries to populate">
          Cross-Domain Student Reach
        </ASectionTitle>
        {!hasAnyData ? (
          <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            No reach data yet. Add student numbers to evidence entries using Student-Facing or Whole School provision types.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Domain</th>
                  <th style={{ textAlign: 'right', padding: '8px 8px', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Total</th>
                  {REACH_GROUPS.map((g, gi) => (
                    <th key={g.field} style={{ textAlign: 'right', padding: '8px 8px', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {g.label}
                      {CTX_COHORTS[gi].cohort > 0 && (
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400 }}>
                          of {CTX_COHORTS[gi].cohort}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reachMatrix.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1A202C' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.colour, marginRight: 8 }} />
                      {row.domain}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: row.totalReach > 0 ? '#1A202C' : '#cbd5e1', fontWeight: row.totalReach > 0 ? 700 : 400 }}>
                      {row.totalReach || '—'}
                    </td>
                    {row.groups.map((g, gi) => {
                      const cohort = CTX_COHORTS[gi].cohort
                      const pct = cohort > 0 ? Math.round((g.total / cohort) * 100) : null
                      const isGap = row.totalReach > 0 && cohort > 0 && g.total === 0
                      return (
                        <td key={gi} style={{
                          textAlign: 'right', padding: '10px 8px',
                          background: isGap ? '#fef2f2' : 'transparent',
                          color: g.total > 0 ? '#1A202C' : isGap ? '#ef4444' : '#cbd5e1',
                          fontWeight: g.total > 0 ? 600 : 400,
                        }}>
                          {g.total > 0 ? (
                            <>
                              {g.total}
                              {pct !== null && <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 4 }}>({pct}%)</span>}
                            </>
                          ) : isGap ? (
                            <span title="Gap: this domain reaches students but none recorded for this group">⚠</span>
                          ) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {schoolCtx.totalPupils > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2 + REACH_GROUPS.length} style={{ padding: '8px 12px', fontSize: '0.7rem', color: '#94a3b8', borderTop: '2px solid #e2e8f0' }}>
                      ⚠ Red cells indicate domains with student-facing provision but zero reach recorded for that group. Percentages are of school cohort totals.
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </ACard>

      {hasAnyData && (
        <ACard>
          <ASectionTitle sub="How each domain reaches key student groups">Group Reach by Domain</ASectionTitle>
          {REACH_GROUPS.map((g, gi) => {
            const cohort = CTX_COHORTS[gi].cohort
            const max = Math.max(...reachMatrix.map(r => r.groups[gi].total), cohort || 0, 1)
            const rowsWithData = reachMatrix.filter(r => r.groups[gi].total > 0)
            return (
              <div key={g.field} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A202C' }}>{g.label}</span>
                  {cohort > 0 && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Cohort: {cohort}</span>}
                </div>
                {rowsWithData.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>No data</p>
                ) : (
                  reachMatrix.map((row, ri) => {
                    const val = row.groups[gi].total
                    const barPct = Math.round((val / max) * 100)
                    return (
                      <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', width: 88, flexShrink: 0, textAlign: 'right' }}>{row.shortName}</span>
                        <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: row.colour, borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: val > 0 ? '#1A202C' : '#cbd5e1', fontWeight: 600, width: 32, textAlign: 'right' }}>{val || '—'}</span>
                      </div>
                    )
                  })
                )}
                {cohort > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', width: 88, flexShrink: 0, textAlign: 'right' }}>Cohort</span>
                    <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: `${Math.min(Math.round((cohort / max) * 100), 100)}%`, top: -1, width: 2, height: 8, background: '#94a3b8', borderRadius: 1 }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', width: 32, textAlign: 'right' }}>{cohort}</span>
                  </div>
                )}
              </div>
            )
          })}
        </ACard>
      )}
    </div>
  )
}

function DemoBanner({ onDismiss }) {
  return (
    <div style={{
      background: '#FDEFD8',
      borderLeft: '6px solid #D4751A',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1B365D', margin: 0, flex: 1, minWidth: 200 }}>
        You're exploring a demo school — ready to try it with your own data?
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <a
          href="mailto:hello@inclusiondashboard.co.uk"
          style={{
            fontSize: '0.875rem', fontWeight: 600, color: '#D4751A',
            textDecoration: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
        >
          Get in touch →
        </a>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#1B365D', opacity: 0.5, fontSize: '1rem',
            padding: '0 4px', lineHeight: 1, fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function DemoAutoLogin() {
  const [error, setError] = useState(null)
  const attempted = useRef(false)

  useEffect(() => {
    console.log('[DemoAutoLogin] component mounted')

    // Guard: fire at most once per mount regardless of React re-renders or
    // mobile WebKit re-invocations. This is the mobile loop fix — do not remove.
    if (attempted.current) {
      console.log('[DemoAutoLogin] already attempted — skipping (loop guard)')
      return
    }
    attempted.current = true

    // Set demoEntry immediately — consumed by the App routing block as a
    // belt-and-suspenders guarantee of /mat-dashboard destination.
    console.log('[DemoAutoLogin] setting demoEntry flag')
    sessionStorage.setItem('demoEntry', 'true')

    async function run() {
      // Always sign out any persisted session before signing in.
      // Without this, a returning visitor whose demo session is still cached in
      // localStorage would be routed via the existing session before demoEntry
      // is consumed — potentially landing on the school view instead of /mat-dashboard.
      console.log('[DemoAutoLogin] signing out existing session')
      await supabase.auth.signOut()
      console.log('[DemoAutoLogin] signOut complete')

      console.log('[DemoAutoLogin] attempting sign in')
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: 'demo@testschool.co.uk',
        password: 'DemoAccess2026!',
      })

      console.log('[DemoAutoLogin] signIn result:', signInError ? 'ERROR: ' + signInError.message : 'success')

      if (signInError) {
        setError(signInError.message)
      } else {
        sessionStorage.setItem('isDemoMode', 'true')
        console.log('[DemoAutoLogin] redirecting to /mat-dashboard')
        window.location.replace('/mat-dashboard')
      }
    }

    run()
  }, [])

  const centre = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--font-base)', gap: '0.75rem' }

  if (error) return (
    <div style={centre}>
      <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Couldn't connect to the demo.</p>
      <p style={{ color: 'var(--text-meta)', fontSize: '0.875rem' }}>{error}</p>
      <a href="/" style={{ color: 'var(--brand-navy)', fontSize: '0.9rem' }}>← Back to home</a>
    </div>
  )

  return <LoadingScreen />
}

function SchoolContextPanel({ schoolCtx, onSave, ctxLoading, readOnly = false }) {
  const [editingCtx, setEditingCtx] = useState(false)
  const [ctxDraft, setCtxDraft] = useState({})

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>School Context</p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total pupils', value: schoolCtx.totalPupils },
              { label: 'PP',           value: schoolCtx.ppCount },
              { label: 'SEND',         value: schoolCtx.sendCount },
              { label: 'FSM',          value: schoolCtx.fsmCount },
              { label: 'EAL',          value: schoolCtx.ealCount },
              { label: 'LAC',          value: schoolCtx.lacCount },
              { label: 'WW Class',     value: schoolCtx.wwcCount },
              { label: 'Social Care',            value: schoolCtx.socialCareCount },
              { label: 'Young Carer',            value: schoolCtx.youngCarerCount },
              { label: 'Mental Health Support',  value: schoolCtx.mentalHealthSupportCount },
            ].map((f, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1A202C' }}>{ctxLoading ? '…' : (f.value || '—')}</p>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={async () => {
              if (editingCtx) {
                const updated = { ...ctxDraft }
                setEditingCtx(false)
                await onSave(updated)
              } else {
                setCtxDraft({ ...schoolCtx })
                setEditingCtx(true)
              }
            }}
            style={{ fontSize: '0.78rem', color: '#1B365D', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', flexShrink: 0 }}
          >
            {editingCtx ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      {editingCtx && !readOnly && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 16px' }}>
          {[
            { key: 'totalPupils', label: 'Total pupils' },
            { key: 'ppCount',    label: 'Pupil Premium' },
            { key: 'sendCount',  label: 'SEND' },
            { key: 'fsmCount',   label: 'FSM' },
            { key: 'ealCount',   label: 'EAL' },
            { key: 'lacCount',   label: 'LAC' },
            { key: 'wwcCount',   label: 'WW Class' },
            { key: 'socialCareCount',           label: 'Social Care' },
            { key: 'youngCarerCount',           label: 'Young Carer' },
            { key: 'mentalHealthSupportCount',  label: 'Mental Health Support' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>{f.label}</label>
              <input
                type="number" min="0"
                style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem' }}
                value={ctxDraft[f.key] ?? 0}
                onChange={e => setCtxDraft(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Shared icon/control tooltip — hover-to-show on desktop, tap-to-show/tap-to-dismiss on
// touch. Generic: wraps any trigger element (icon button, badge) and shows `text` near it.
// Built fresh rather than extending the existing Provision Depth chart tooltip (that one is
// mouse-only and lives in an unrelated component) — but reuses its technique of computing a
// fixed-position rect from the trigger on show, since rows here sit inside ancestor cards
// with `overflow: hidden` (both the Category/Principle drill-down and the Domain page) and a
// plain absolutely-positioned tooltip would get clipped by that.
//
// `actionable` — pass this when the wrapped element has a real onClick (status control, Add
// Evidence, flag icon). A real touch tap always fires the browser's native click regardless of
// what our own touchstart handler does (confirmed live: the original tap-to-toggle logic showed
// the tooltip AND the click fired in the same gesture, so tapping status/Add-Evidence opened the
// modal with the tooltip flashing uselessly behind it). For those, touch instead uses a
// long-press: holding past ~500ms shows the tooltip and calls preventDefault() on touchend to
// swallow the click that would otherwise follow; releasing before the threshold is a normal tap
// and the click proceeds untouched. The evidence-count badge has no click to protect and keeps
// the original quick tap-to-show/tap-to-dismiss behaviour (`actionable` omitted/false).
const LONG_PRESS_MS = 500

function IconTooltip({ text, children, actionable = false }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)

  function show() {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const halfW = 90
    const left = Math.min(Math.max(rect.left + rect.width / 2, halfW + 8), window.innerWidth - halfW - 8)
    setPos({ left, top: rect.top - 8 })
    setVisible(true)
  }
  function hide() { setVisible(false) }

  useEffect(() => {
    if (!visible) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) hide()
    }
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [visible])

  useEffect(() => () => clearTimeout(longPressTimer.current), [])

  function handleTouchStart() {
    if (!actionable) {
      visible ? hide() : show()
      return
    }
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      show()
    }, LONG_PRESS_MS)
  }
  function handleTouchEnd(e) {
    if (!actionable) return
    clearTimeout(longPressTimer.current)
    if (longPressFired.current) {
      // Long-press already showed the tooltip — swallow the click the browser would
      // otherwise synthesize from this same touch, so it doesn't also fire the action.
      e.preventDefault()
      hide()
    }
    longPressFired.current = false
  }
  function handleTouchMove() {
    if (!actionable) return
    clearTimeout(longPressTimer.current)
  }

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {children}
      {visible && pos && (
        <span role="tooltip" style={{
          position: 'fixed', left: pos.left, top: pos.top,
          transform: 'translate(-50%, -100%)',
          background: '#1A202C', color: '#fff',
          padding: '5px 9px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 500,
          pointerEvents: 'none', zIndex: 9999, maxWidth: 180,
          textAlign: 'center', lineHeight: 1.4, whiteSpace: 'normal',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

function ProvisionPointRow({ pp, ppIdx, status, evidenceList, onOpenModal, readOnly, isFlagged, onFlag, submittedAt }) {
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)
  const [flagError, setFlagError] = useState(false)

  // Pending checked first — it's a distinct state from status and must win regardless of
  // what status was before submission (Phase 0: submit-for-approval never touches status).
  const isPending = !!submittedAt
  const badge = isPending
    ? { icon: 'ti-send-2',       colour: '#7C3AED', bg: 'rgba(124,58,237,0.10)', label: 'Pending Approval' }
    : status === 'in_place'
      ? { icon: 'ti-circle-check', colour: '#257A3B', bg: 'rgba(37,122,59,0.10)',  label: 'In Place' }
      : status === 'in_progress'
        ? { icon: 'ti-progress',    colour: '#D4751A', bg: 'rgba(212,117,26,0.10)', label: 'In Progress' }
        : status === 'not_in_place'
          ? { icon: 'ti-circle-x',  colour: '#EA4335', bg: 'rgba(234,67,53,0.10)',  label: 'Not in Place' }
          : { icon: 'ti-circle',    colour: '#94a3b8', bg: '#F0F2F5',               label: 'Untouched' }
  const stripeColour = isPending ? badge.colour : (status === 'in_place' ? '#257A3B' : status === 'in_progress' ? '#D4751A' : status === 'not_in_place' ? '#EA4335' : '#E2E8F0')

  async function submitFlag() {
    setFlagSaving(true)
    setFlagError(false)
    const ok = await onFlag(pp.id, flagNote)
    setFlagSaving(false)
    if (ok) {
      setFlagOpen(false)
      setFlagNote('')
    } else {
      setFlagError(true)
    }
  }

  return (
    <div className="pp-row"
      style={{
        borderLeft: `3px solid ${stripeColour}`,
        borderTop: ppIdx > 0 ? '0.5px solid #f1f5f9' : 'none',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: '#1A202C' }}>{pp.label}</span>
        {evidenceList.length > 0 && (
          <IconTooltip text={`${evidenceList.length} evidence ${evidenceList.length === 1 ? 'entry' : 'entries'}`}>
            <span className="evidence-count-badge">
              {evidenceList.length}
            </span>
          </IconTooltip>
        )}
        <div className="provision-actions">
          {/* Single status control — the evidence modal is now the only place status or
              submission fields get written; clicking it (or the action button) just opens
              that modal, nothing here writes anything directly. */}
          <IconTooltip text={badge.label} actionable>
            <button
              type="button"
              onClick={() => onOpenModal(pp)}
              aria-label={badge.label}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                border: 'none', background: badge.bg, color: badge.colour,
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <i className={`ti ${badge.icon}`} style={{ fontSize: 15 }} />
            </button>
          </IconTooltip>
          {!readOnly && (
            <IconTooltip text={evidenceList.length > 0 ? 'View / Add evidence' : 'Add evidence'} actionable>
              <button
                type="button"
                aria-label={evidenceList.length > 0 ? 'View / Add evidence' : 'Add evidence'}
                onClick={() => onOpenModal(pp)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  border: '1.5px solid #1B365D', background: '#fff', color: '#1B365D',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1B365D'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1B365D' }}
              >
                <i className="ti ti-file-plus" style={{ fontSize: 14 }} />
              </button>
            </IconTooltip>
          )}
          {!readOnly && (
            <IconTooltip text="Flag an issue" actionable>
              <button
                type="button"
                aria-label="Flag an issue with this provision point"
                onClick={() => setFlagOpen(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 6px',
                  border: `0.5px solid ${isFlagged ? '#EA4335' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: isFlagged ? '#FCEBEB' : '#fff',
                  color: isFlagged ? '#EA4335' : '#94a3b8',
                  cursor: 'pointer', lineHeight: 1,
                  transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!isFlagged) { e.currentTarget.style.borderColor = '#EA4335'; e.currentTarget.style.color = '#EA4335' } }}
                onMouseLeave={e => { if (!isFlagged) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8' } }}
              >
                <i className={`ti ${isFlagged ? 'ti-flag-filled' : 'ti-flag'}`} style={{ fontSize: 14 }} />
              </button>
            </IconTooltip>
          )}
        </div>
      </div>
      {evidenceList.length > 0 && (
        <ul className="evidence-list">
          {evidenceList.map(ev => (
            <li key={ev.id}>
              <button type="button" className="evidence-list-item" onClick={() => onOpenModal(pp, ev)}>
                {ev.provision_name || 'Untitled entry'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {flagOpen && (
        <div style={{ padding: '10px 16px 12px', borderTop: '0.5px solid #f1f5f9', background: '#fafafa' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>What's the issue?</p>
          <textarea
            rows={3}
            placeholder="Describe the friction or confusion (optional)"
            value={flagNote}
            onChange={e => { setFlagNote(e.target.value); setFlagError(false) }}
            style={{
              width: '100%', fontSize: 12, padding: '7px 10px',
              border: '1px solid #e2e8f0', borderRadius: 6,
              resize: 'vertical', fontFamily: 'inherit', color: '#1A202C',
              boxSizing: 'border-box',
            }}
          />
          {flagError && (
            <p style={{ fontSize: 12, color: '#EA4335', marginTop: 4 }}>Could not save — please try again</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={submitFlag}
              disabled={flagSaving}
              style={{
                padding: '5px 14px', background: '#EA4335', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: flagSaving ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: flagSaving ? 0.7 : 1,
              }}
            >
              {flagSaving ? 'Saving…' : 'Submit flag'}
            </button>
            <button
              type="button"
              onClick={() => { setFlagOpen(false); setFlagNote(''); setFlagError(false) }}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#1B365D', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared drill-down detail view — renders a header + domain-grouped, truncated list of
// provision points for a given filter value (category or principle). The caller decides
// which points to include (ppIds) and what to label the header with; this component doesn't
// care which field the filter came from. `pp.category` for each row is always the point's own
// real category from ppInfoMap (not the filter value) — required so ProvisionPointRow's save
// path (Named Person direct-write check, category-specific document field) stays correct even
// when the filter itself is principle, where points span multiple categories.
function DrillDownDetail({
  title, ppIds, domains, ppInfoMap, allStatuses, evidenceEntries, entries, flaggedPoints,
  expandedDomains, onToggleDomain, onBack, openModal, readOnly, onFlag,
}) {
  const total   = ppIds.length
  const inPlace = ppIds.filter(id => allStatuses[id] === 'in_place').length

  const domainGroupMap = {}
  for (const ppId of ppIds) {
    const info = ppInfoMap[ppId]
    if (!info) continue
    if (!domainGroupMap[info.domainId]) {
      domainGroupMap[info.domainId] = { domainId: info.domainId, domainName: info.domainName, pps: [] }
    }
    domainGroupMap[info.domainId].pps.push({ id: ppId, label: info.label, category: info.category })
  }
  const domainGroupList = domains.filter(d => domainGroupMap[d.id]).map(d => domainGroupMap[d.id])

  return (
    <div>
      <button type="button" onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '6px 14px',
        border: '1px solid #CBD5E0', borderRadius: 8, background: 'transparent', color: '#4A5568',
        fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
      }}>← Back</button>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A202C' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} point{total !== 1 ? 's' : ''} · {inPlace} in place</span>
      </div>

      {domainGroupList.map(group => {
        const isExpanded  = expandedDomains.has(group.domainId)
        const pps         = group.pps
        const ppCount     = pps.length
        const domColour   = sidebarDomainColour(group.domainName)
        const grpInPlace  = pps.filter(p => allStatuses[p.id] === 'in_place').length
        const grpInProg   = pps.filter(p => allStatuses[p.id] === 'in_progress').length
        const grpUntouched = pps.filter(p => !allStatuses[p.id]).length
        const needsTrunc  = ppCount > 3 && !isExpanded
        const visiblePPs  = needsTrunc ? pps.slice(0, 3) : pps

        return (
          <div key={group.domainId} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <button type="button" onClick={() => onToggleDomain(group.domainId)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '0.5px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left',
              }}>
              <i className="ti ti-chevron-down" style={{ fontSize: '0.8rem', color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: domColour, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1A202C' }}>{group.domainName}</span>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 2 }}>({ppCount})</span>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#334155' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#257A3B', display: 'inline-block', flexShrink: 0 }} />
                  {grpInPlace}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#334155' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4751A', display: 'inline-block', flexShrink: 0 }} />
                  {grpInProg}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
                  {grpUntouched}
                </span>
              </div>
            </button>

            <div style={{ position: 'relative' }}>
              {visiblePPs.map((pp, ppIdx) => (
                <ProvisionPointRow
                  key={pp.id}
                  pp={pp}
                  ppIdx={ppIdx}
                  status={allStatuses[pp.id]}
                  evidenceList={evidenceEntries[pp.id] ?? []}
                  onOpenModal={openModal}
                  readOnly={readOnly}
                  isFlagged={flaggedPoints.has(pp.id)}
                  onFlag={onFlag}
                  submittedAt={entries[pp.id]?.submitted_for_approval_at}
                />
              ))}
              {needsTrunc && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, rgba(255,255,255,0), #fff)', pointerEvents: 'none' }} />
              )}
            </div>

            <ShowToggle expanded={isExpanded} total={ppCount} onToggle={() => onToggleDomain(group.domainId)} />
          </div>
        )
      })}
    </div>
  )
}

function ShowToggle({ expanded, total, onToggle }) {
  if (total <= 3) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', borderTop: '0.5px solid #f1f5f9' }}>
      <button type="button" onClick={onToggle} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 12, color: '#1B365D', padding: '4px 8px',
      }}>
        {expanded
          ? <>Show less <i className="ti ti-chevron-up" style={{ fontSize: '0.75rem' }} /></>
          : <>Show all {total} points <i className="ti ti-chevron-down" style={{ fontSize: '0.75rem' }} /></>
        }
      </button>
    </div>
  )
}

export default function App() {
  // Auth state
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [forgotStatus, setForgotStatus] = useState(null) // null | 'success' | 'error' | 'no-email'

  const [domains, setDomains] = useState([])
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subDomains, setSubDomains] = useState([])
  const [entries, setEntries] = useState({})
  const [evidenceEntries, setEvidenceEntries] = useState({})
  const [loading, setLoading] = useState(false)
  const [ppDomainMap, setPpDomainMap] = useState({})
  const [domainTotals, setDomainTotals] = useState({})
  const [allStatuses, setAllStatuses] = useState({})
  const [, setAllEvidenceCounts] = useState({})
  const [allSubDomains, setAllSubDomains] = useState([])
  const [ppCategoryMap, setPpCategoryMap] = useState({})
  const [ppPrincipleMap, setPpPrincipleMap] = useState({})
  const [ppInfoMap, setPpInfoMap]         = useState({})
  const [overviewMode, setOverviewMode]   = useState('domain')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedPrinciple, setSelectedPrinciple] = useState(null)

  // School context — SchoolContextPanel now renders on the homepage (its only home since
  // Analytics, the only other place it lived, was removed).
  const [schoolCtx, setSchoolCtx] = useState({ totalPupils: 0, ppCount: 0, sendCount: 0, fsmCount: 0, ealCount: 0, lacCount: 0, wwcCount: 0, socialCareCount: 0, youngCarerCount: 0, mentalHealthSupportCount: 0 })
  const [ctxLoading, setCtxLoading] = useState(true)

  // Home screen extras
  const [firstName, setFirstName] = useState('')
  const [overdueReviews, setOverdueReviews] = useState([])
  const [reviewsExpanded, setReviewsExpanded] = useState(false)
  const [approvalQueueCount, setApprovalQueueCount] = useState(0)
  const [approvalQueueOpen, setApprovalQueueOpen] = useState(false)
  const [selfAssignOpen, setSelfAssignOpen] = useState(false)
  const [confirmingReviewId, setConfirmingReviewId] = useState(null)
  const [confirmReviewError, setConfirmReviewError] = useState(null)

  // Sidebar state
  const [activeSidebarSection, setActiveSidebarSection] = useState(null)
  const [expandedCatDomains, setExpandedCatDomains] = useState(new Set())

  const [flaggedPoints, setFlaggedPoints] = useState(new Set())
  const [utFilter, setUtFilter] = useState('all')  // 'all' | 'universal' | 'targeted'

  // Mobile sidebar
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [demoBannerVisible, setDemoBannerVisible] = useState(sessionStorage.getItem('demoBannerDismissed') !== 'true')

  // MAT / role state
  const [userRole, setUserRole] = useState('contributor')
  const [isFounder, setIsFounder] = useState(false)
  const [userMatId, setUserMatId] = useState(null)
  const [ownSchoolId, setOwnSchoolId] = useState(null) // the logged-in user's own school_id, per their profile — distinct from selectedSchool, which is whatever school is currently being viewed
  // 'school' | 'mat' | 'school_readonly'
  const [view, setView] = useState('school')

  // Personal view state — 'whole_school' | 'personal' | <userId UUID>
  const [viewMode, setViewMode] = useState('whole_school')
  const [personalAssignedPpIds, setPersonalAssignedPpIds] = useState(new Set())
  const [teamMembers, setTeamMembers] = useState([])
  const [browsingSchoolName, setBrowsingSchoolName] = useState('')

  // Onboarding / welcome state
  const [missingProfile, setMissingProfile] = useState(false)
  const [needsPasswordSet, setNeedsPasswordSet] = useState(false)
  const [passwordExpired, setPasswordExpired] = useState(false)
  const [onboardingState, setOnboardingState] = useState(null)
  const [firstLoginPromptVisible, setFirstLoginPromptVisible] = useState(false)
  const [bootstrapWizardVisible, setBootstrapWizardVisible] = useState(false)
  // Per-session-only bypass for the My Points gate — set when a contributor explicitly
  // exits (either button) without ticking "Don't show this again", so the gate doesn't
  // block every render for the rest of THIS session, but still reappears next login since
  // profiles.welcomed stays false.
  const [myPointsGateBypassed, setMyPointsGateBypassed] = useState(false)
  const [sidebarFlashTeam, setSidebarFlashTeam] = useState(false)
  const [welcomed, setWelcomed] = useState(true)
  // Toasts for approval_notifications rows not yet seen — shown once on dashboard load,
  // then marked seen_at so they don't reappear on a later reload.
  const [approvalToasts, setApprovalToasts] = useState([])

  // Evidence modal state
  const [modalPoint, setModalPoint] = useState(null)
  const [draft, setDraft] = useState({})
  const [draftId, setDraftId] = useState(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalSaveMsg, setModalSaveMsg] = useState(null)
  const [modalSaveError, setModalSaveError] = useState(false)
  const [modalExpanded, setModalExpanded] = useState(false)
  // Whether the user has manually picked a Status value this modal session — once true,
  // typing into the document/notes fields never auto-selects a status again.
  const [statusTouched, setStatusTouched] = useState(false)
  const modalRef = useRef(null)
  // Freeze pathname at mount — window.location.replace() updates window.location.pathname
  // synchronously, so re-reading it on every render causes the /demo route to fall through
  // to the authLoading guard during the sign-in flow, producing a visible flash on mobile.
  const pathnameRef = useRef(window.location.pathname)

  // Tracks which user id the profile-driven state (role/view/selectedSchool)
  // was last initialized for. Supabase's visibilitychange-triggered session
  // recheck re-fires onAuthStateChange on tab refocus even with no real
  // sign-in/out — without this guard the profile effect below would re-run
  // and stomp in-session navigation (e.g. a MAT admin drilled into a school)
  // back to the role's default view.
  const initializedUserIdRef = useRef(null)

  // Invite user modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteJobTitle, setInviteJobTitle] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)  // { type: 'success'|'error', text: string }
  const inviteModalRef = useRef(null)

  // Initialise auth: restore session and subscribe to changes.
  // Do NOT clear authLoading here — we wait until the profile fetch resolves
  // so the loading screen stays up until we know the correct initial view.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If the invite hash was detected at module load and getSession() resolves
      // with the invite session before onAuthStateChange fires SIGNED_IN, catch it here.
      if (session && sessionStorage.getItem('pendingSetPassword') === 'true') {
        sessionStorage.removeItem('pendingSetPassword')
        if (!window.location.pathname.startsWith('/set-password')) {
          console.log('[Invite] getSession resolved with invite session — redirecting to /set-password')
          window.location.replace('/set-password')
          return
        }
      }
      setSession(session)
      // authLoading cleared by the session effect once profile is resolved
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] state change — event:', _event, '| user:', session?.user?.email ?? 'none', '| pendingSetPassword:', sessionStorage.getItem('pendingSetPassword'))
      // Intercept invite-link sign-ins. The flag is set at module load before Supabase
      // consumes the URL hash. We check both SIGNED_IN (if the event fires after we
      // subscribe) and INITIAL_SESSION (if Supabase processed the hash before our
      // subscriber was registered — in that case the first notification uses INITIAL_SESSION).
      if ((_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') && session && sessionStorage.getItem('pendingSetPassword') === 'true') {
        sessionStorage.removeItem('pendingSetPassword')
        if (!window.location.pathname.startsWith('/set-password')) {
          console.log('[Invite] auth event', _event, 'with pendingSetPassword flag — redirecting to /set-password')
          window.location.replace('/set-password')
          return // do not setSession — page will reload at /set-password
        }
        console.log('[Invite] already on /set-password — flag cleared, no redirect needed')
        return
      }
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Shows a toast for each not-yet-seen approval_notifications row (an approver confirmed a
  // point this user submitted), then immediately marks them seen so a later reload doesn't
  // show the same ones again. Declared before the profile-fetch effect below, which calls it.
  async function loadApprovalNotifications(userId) {
    const { data, error } = await supabase
      .from('approval_notifications')
      .select('id, entries(provision_points(label))')
      .eq('user_id', userId)
      .is('seen_at', null)
    if (error || !data || data.length === 0) return

    setApprovalToasts(data.map(n => ({ id: n.id, label: n.entries?.provision_points?.label ?? 'A point' })))

    const ids = data.map(n => n.id)
    const { error: seenErr } = await supabase
      .from('approval_notifications')
      .update({ seen_at: new Date().toISOString() })
      .in('id', ids)
    if (seenErr) console.error('Error marking approval notifications seen:', seenErr)
  }

  function dismissApprovalToast(id) {
    setApprovalToasts(prev => prev.filter(t => t.id !== id))
  }

  // When session changes: load profile (→ role + school) and domain structure.
  // authLoading is cleared here once we know which view to show.
  useEffect(() => {
    if (!session) {
      initializedUserIdRef.current = null
      setSelectedSchool('')
      setSchoolName('')
      setDomains([])
      setPpDomainMap({})
      setDomainTotals({})
      setAllStatuses({})
      setAllEvidenceCounts({})
      setAllSubDomains([])
      setPpCategoryMap({})
      setPpPrincipleMap({})
      setPpInfoMap({})
      setOverviewMode('domain')
      setSelectedCategory(null)
      setSelectedPrinciple(null)
      setUserRole('contributor')
      setViewMode('whole_school')
      setPersonalAssignedPpIds(new Set())
      setTeamMembers([])
      setMissingProfile(false)
      setNeedsPasswordSet(false)
      setOnboardingState(null)
      setFirstLoginPromptVisible(false)
      setBootstrapWizardVisible(false)
      setMyPointsGateBypassed(false)
      setSidebarFlashTeam(false)
      setWelcomed(true)
      setUserMatId(null)
      setOwnSchoolId(null)
      setView('school')
      setBrowsingSchoolName('')
      setAuthLoading(false)
      return
    }

    if (initializedUserIdRef.current === session.user.id) {
      // Same user already initialized — this fire is a token refresh or
      // tab-refocus recheck, not a real sign-in. Leave in-session navigation
      // state (view, selectedSchool, etc.) untouched.
      return
    }

    setPasswordExpired(false)

    supabase
      .from('profiles')
      .select('school_id, role, mat_id, first_name, schools(name), onboarding_state, welcomed, password_set, temp_password_issued_at, is_founder')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        console.log('[profile fetch] data:', JSON.stringify(data), 'error:', JSON.stringify(error))
        if (error || !data) {
          console.error('[Profile] fetch error:', error)
          setMissingProfile(true)
          setAuthLoading(false)
          return
        }
        // Invited user who hasn't set a password yet — send to /set-password.
        // !== true (not === false) so a NULL/undefined password_set — e.g. a profile
        // row written outside the app's own invite functions — fails toward requiring
        // a password set, rather than silently skipping the redirect.
        if (data.password_set !== true) {
          // Temp passwords (from onboard-school / invite-user / resend-invite) expire
          // 7 days after issuance if unused — block login instead of letting them keep
          // trying a stale password indefinitely.
          const issuedAt = data.temp_password_issued_at ? new Date(data.temp_password_issued_at) : null
          const daysSinceIssued = issuedAt ? (Date.now() - issuedAt.getTime()) / (1000 * 60 * 60 * 24) : null
          if (daysSinceIssued !== null && daysSinceIssued > 7) {
            supabase.auth.signOut()
            setPasswordExpired(true)
            setAuthLoading(false)
            return
          }
          setNeedsPasswordSet(true)
          setAuthLoading(false)
          return
        }
        // Founder accounts land on the admin dashboard by default — but only on the
        // plain root landing. If they've manually navigated elsewhere (e.g. /mat-dashboard
        // to check the demo MAT), let that navigation stand instead of overriding it.
        if (data.is_founder === true && ['/', '/dashboard', '/login'].includes(pathnameRef.current)) {
          window.location.replace('/admin')
          return
        }
        setIsFounder(data.is_founder === true)
        const role = data.role ?? 'contributor'
        console.log('[Profile] loaded — role:', role, '| mat_id:', data.mat_id, '| school_id:', data.school_id)
        setUserRole(role)
        setViewMode(role === 'contributor' ? 'personal' : 'whole_school')
        setUserMatId(data.mat_id ?? null)
        setOwnSchoolId(data.school_id ?? null)
        setFirstName(data.first_name ?? '')
        const os = data.onboarding_state ?? {}
        setOnboardingState(os)
        setWelcomed(data.welcomed ?? false)
        if (role === 'approver' && !os.team_prompt_dismissed) {
          setFirstLoginPromptVisible(true)
        }
        if (role === 'approver' && !os.bootstrap_wizard_dismissed) {
          setBootstrapWizardVisible(true)
        }
        if (role === 'mat_admin') {
          setView('mat')
        } else {
          setSelectedSchool(data.school_id)
          setSchoolName(data.schools?.name ?? '')
          setView('school')
        }
        setAuthLoading(false)
        initializedUserIdRef.current = session.user.id
        loadApprovalNotifications(session.user.id)
      })

    supabase
      .from('domains')
      .select('id, name, display_order, sub_domains(id, name, provision_points(id, label, category, principle))')
      .order('display_order')
      .then(({ data, error }) => {
        if (error) { console.error('Error loading domains:', error); return }
        const newPpDomainMap    = {}
        const newDomainTotals   = {}
        const newSubDomains     = []
        const newPpCategoryMap  = {}
        const newPpPrincipleMap = {}
        const newPpInfoMap      = {}
        for (const domain of data ?? []) {
          let count = 0
          for (const sd of domain.sub_domains ?? []) {
            newSubDomains.push({ id: sd.id, name: sd.name, domainId: domain.id, domainName: domain.name })
            for (const pp of sd.provision_points ?? []) {
              newPpDomainMap[pp.id] = domain.id
              newPpCategoryMap[pp.id] = pp.category ?? ''
              newPpPrincipleMap[pp.id] = pp.principle ?? ''
              newPpInfoMap[pp.id] = { label: pp.label, domainId: domain.id, domainName: domain.name, subDomainName: sd.name, category: pp.category ?? '' }
              count++
            }
          }
          newDomainTotals[domain.id] = count
        }
        setDomains((data ?? []).map(({ sub_domains: _sd, ...d }) => d))
        setPpDomainMap(newPpDomainMap)
        setDomainTotals(newDomainTotals)
        setAllSubDomains(newSubDomains)
        setPpCategoryMap(newPpCategoryMap)
        setPpPrincipleMap(newPpPrincipleMap)
        setPpInfoMap(newPpInfoMap)
      })
  }, [session])

  // Load school context from Supabase
  useEffect(() => {
    if (!selectedSchool) { setCtxLoading(false); return }
    setCtxLoading(true)
    supabase
      .from('school_context')
      .select('total_pupils, pp_count, send_count, fsm_count, eal_count, lac_count, wwc_count, social_care_count, young_carer_count, mental_health_support_count')
      .eq('school_id', selectedSchool)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Error loading school context:', error)
        if (data) {
          setSchoolCtx({
            totalPupils: data.total_pupils,
            ppCount:     data.pp_count,
            sendCount:   data.send_count,
            fsmCount:    data.fsm_count,
            ealCount:    data.eal_count,
            lacCount:    data.lac_count,
            wwcCount:    data.wwc_count,
            socialCareCount:           data.social_care_count,
            youngCarerCount:           data.young_carer_count,
            mentalHealthSupportCount:  data.mental_health_support_count,
          })
        }
        setCtxLoading(false)
      })
  }, [selectedSchool])

  // Reviews for home screen reviews panel — already-overdue rows, plus rows due within
  // the next 60 days ("due soon"), kept distinguishable via isOverdue on each item. Widened
  // from 30 to 60 days when the Analytics "Domain Readiness" tab was removed, so this panel's
  // coverage absorbs its former "Compliance Forecast" widget's 60-day window rather than
  // standing up a second, competing "what's due for review" list alongside this one.
  useEffect(() => {
    if (!selectedSchool) { setOverdueReviews([]); return }
    const todayDate = new Date()
    const today = todayDate.toISOString().slice(0, 10)
    const horizonDate = new Date(todayDate)
    horizonDate.setDate(horizonDate.getDate() + 60)
    const horizon = horizonDate.toISOString().slice(0, 10)
    supabase
      .from('entries')
      .select(`provision_point_id, evidence_entries(
        id, provision_name, next_review_due, review_cycle, date_last_reviewed, date_started, created_at,
        brief_description, named_role_policy_document, supporting_document_link, structured_detail
      )`)
      .eq('school_id', selectedSchool)
      .then(({ data }) => {
        if (!data) return
        const upcoming = []
        for (const entry of data) {
          for (const ev of entry.evidence_entries ?? []) {
            if (ev.next_review_due && ev.next_review_due <= horizon) {
              upcoming.push({
                evidenceEntryId:        ev.id,
                provisionPointId:       entry.provision_point_id,
                provisionName:          ev.provision_name || '',
                nextReviewDue:          ev.next_review_due,
                reviewCycle:            ev.review_cycle,
                dateLastReviewed:       ev.date_last_reviewed,
                dateStarted:            ev.date_started,
                createdAt:              ev.created_at,
                briefDescription:       ev.brief_description,
                namedRolePolicyDocument: ev.named_role_policy_document,
                supportingDocumentLink: ev.supporting_document_link,
                structuredDetail:       ev.structured_detail,
                isOverdue:              ev.next_review_due <= today,
              })
            }
          }
        }
        upcoming.sort((a, b) => a.nextReviewDue.localeCompare(b.nextReviewDue))
        setOverdueReviews(upcoming)
        setReviewsExpanded(false)
      })
  }, [selectedSchool])

  // Approval queue count for the dashboard pill — approver/mat_admin only.
  function loadApprovalQueueCount() {
    if (!selectedSchool || (userRole !== 'approver' && userRole !== 'mat_admin')) {
      setApprovalQueueCount(0)
      return
    }
    supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', selectedSchool)
      .not('submitted_for_approval_at', 'is', null)
      .then(({ count }) => setApprovalQueueCount(count ?? 0))
  }

  useEffect(() => {
    loadApprovalQueueCount()
  }, [selectedSchool, userRole])

  // Fetch assigned provision point IDs for the personal view
  function loadPersonalAssignedPpIds() {
    if (!selectedSchool || viewMode === 'whole_school') {
      setPersonalAssignedPpIds(new Set())
      return
    }
    const userId = viewMode === 'personal' ? session?.user?.id : viewMode
    if (!userId) { setPersonalAssignedPpIds(new Set()); return }
    supabase
      .from('point_assignments')
      .select('provision_point_id')
      .eq('school_id', selectedSchool)
      .eq('assignee_user_id', userId)
      .then(({ data }) => {
        setPersonalAssignedPpIds(new Set((data ?? []).map(a => a.provision_point_id)))
      })
  }

  useEffect(() => {
    loadPersonalAssignedPpIds()
  }, [viewMode, selectedSchool, session])

  // Fetch team members for the approver dropdown
  useEffect(() => {
    if (!selectedSchool || userRole === 'contributor') { setTeamMembers([]); return }
    supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', selectedSchool)
      .neq('id', session?.user?.id ?? '')
      .then(({ data }) => setTeamMembers(data ?? []))
  }, [selectedSchool, userRole])

  // School-level load: statuses, evidence counts, full evidence detail, and friction flags
  // Fetching at school level (not per-domain) ensures evidenceEntries is populated for
  // both the Domain view and the Category view.
  useEffect(() => {
    if (!selectedSchool) { setAllStatuses({}); setAllEvidenceCounts({}); setEntries({}); setEvidenceEntries({}); setFlaggedPoints(new Set()); return }
    supabase
      .from('entries')
      .select(ENTRY_SELECT)
      .eq('school_id', selectedSchool)
      .then(({ data, error }) => {
        if (error) { console.error('Error loading school data:', error); return }
        const statusMap = {}
        const countMap = {}
        const entryMap = {}
        const evidenceMap = {}
        for (const { provision_point_id, evidence_entries: evList, ...rest } of data ?? []) {
          statusMap[provision_point_id] = rest.status
          countMap[provision_point_id] = (evList ?? []).length
          entryMap[provision_point_id] = rest
          evidenceMap[provision_point_id] = evList ?? []
        }
        setAllStatuses(statusMap)
        setAllEvidenceCounts(countMap)
        setEntries(entryMap)
        setEvidenceEntries(evidenceMap)
      })
    supabase
      .from('friction_logs')
      .select('provision_point_id')
      .eq('school_id', selectedSchool)
      .then(({ data }) => {
        if (data) setFlaggedPoints(new Set(data.map(r => r.provision_point_id)))
      })
  }, [selectedSchool])

  useEffect(() => {
    if (!selectedSchool || !selectedDomain || selectedDomain === 'team' || selectedDomain === 'report-builder' || selectedDomain === 'barriers' || selectedDomain === 'inclusion-strategy') {
      setSubDomains([])
      setUtFilter('all')
      return
    }

    setLoading(true)
    setUtFilter('all')

    supabase
      .from('sub_domains')
      .select('id, name, provision_points(id, label, display_order, universal_or_targeted, category)')
      .eq('domain_id', selectedDomain)
      .order('name')
      .then(subDomainsRes => {
        if (subDomainsRes.error) console.error('Error loading sub_domains:', subDomainsRes.error)

        const grouped = (subDomainsRes.data ?? []).map(sd => ({
          ...sd,
          provision_points: (sd.provision_points ?? []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        }))

        setSubDomains(grouped)
        setLoading(false)
      })
  }, [selectedSchool, selectedDomain])

  useEffect(() => { setExpandedCatDomains(new Set()) }, [selectedCategory, selectedPrinciple])

  function toggleDrillDomain(domainId) {
    setExpandedCatDomains(prev => {
      const next = new Set(prev)
      if (next.has(domainId)) next.delete(domainId)
      else next.add(domainId)
      return next
    })
  }

  useEffect(() => {
    document.body.style.overflow = modalPoint ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalPoint])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // evidenceEntry = null → new; evidenceEntry = existing row → edit
  function openModal(pp, evidenceEntry = null) {
    setModalPoint(pp)
    // status is a transient draft field — it drives the entries write on save, then gets
    // stripped before the evidence_entries payload is built (that table has no such column).
    const currentStatus = entries[pp.id]?.status ?? null
    setDraft(evidenceEntry ? { ...evidenceEntry, status: currentStatus } : { provision_name: pp.label, status: currentStatus })
    setDraftId(evidenceEntry?.id ?? null)
    setModalSaveMsg(null)
    setModalSaveError(false)
    setModalExpanded(false)
    setStatusTouched(false)
  }

  function closeModal() {
    setModalPoint(null)
    setDraft({})
    setDraftId(null)
    setModalSaveMsg(null)
    setModalExpanded(false)
    setStatusTouched(false)
  }

  function handleDraftChange(field, value) {
    setModalSaveMsg(null)
    setDraft(prev => {
      const next = { ...prev, [field]: value }
      // Auto-select In Progress the moment the primary document field or Notes gets typed
      // into — only while the user hasn't manually touched the dropdown themselves, and
      // only if nothing's already selected (manual choice always wins, never overridden).
      if (!statusTouched && !next.status) {
        const cat = next.provision_category ?? ''
        const primaryDocField = cat === 'policy_structural' ? 'named_role_policy_document' : 'supporting_document_link'
        if ((field === primaryDocField || field === 'notes') && String(value ?? '').trim()) {
          next.status = 'in_progress'
        }
      }
      return next
    })
  }

  function handleStatusSelect(value) {
    setModalSaveMsg(null)
    setStatusTouched(true)
    setDraft(prev => ({ ...prev, status: value }))
  }

  async function handleForgotPassword() {
    if (!loginEmail) {
      setForgotStatus('no-email')
      return
    }
    setForgotStatus(null)
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail)
    setForgotStatus(error ? 'error' : 'success')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    setLoginLoading(false)
    if (error) setLoginError(error.message)
  }

  function handleDemoLogin() {
    window.location.href = '/demo'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSelectedDomain('')
  }

  // Shared exit handler for the My Points gate — both "Browse other points" and "Go to
  // dashboard" call this. Ticking "Don't show this again" persists profiles.welcomed so the
  // gate stops auto-showing on future logins; leaving it unticked only bypasses the gate for
  // the rest of this session (myPointsGateBypassed), so it reappears fresh next login.
  async function handleMyPointsExit({ action, dontShowAgain }) {
    setMyPointsGateBypassed(true)
    if (dontShowAgain && session) {
      await supabase.from('profiles').update({ welcomed: true }).eq('id', session.user.id)
      setWelcomed(true)
    }
    if (action === 'browse') {
      setSelfAssignOpen(true)
    }
  }

  function openInviteModal() {
    setInviteFirstName('')
    setInviteLastName('')
    setInviteJobTitle('')
    setInviteEmail('')
    setInviteMsg(null)
    setInviteOpen(true)
  }

  function closeInviteModal() {
    setInviteOpen(false)
    setInviteMsg(null)
  }

  async function handleInviteSubmit(e) {
    e.preventDefault()
    setInviteSending(true)
    setInviteMsg(null)
    try {
      const requestBody = {
        first_name: inviteFirstName.trim(),
        last_name:  inviteLastName.trim(),
        job_title:  inviteJobTitle.trim(),
        email:      inviteEmail,
        role:       'contributor',
        school_id:  selectedSchool,
        mat_id:     userMatId,
      }
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[invite] Sending request to:', 'https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/invite-user')
      console.log('[invite] Request body:', requestBody)
      const res = await fetch('https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb',
        },
        body: JSON.stringify(requestBody),
      })
      const json = await res.json()
      console.log('[invite] Response status:', res.status)
      console.log('[invite] Response body:', json)
      if (!res.ok || json.error) {
        setInviteMsg({ type: 'error', text: json.error ?? 'Something went wrong. Please try again.' })
      } else if (json.profileError) {
        setInviteMsg({ type: 'error', text: `Invite sent but profile could not be created automatically — please contact hello@inclusiondashboard.co.uk.` })
        setInviteFirstName(''); setInviteLastName(''); setInviteJobTitle(''); setInviteEmail('')
      } else {
        if (json.userId && inviteJobTitle.trim()) {
          const { error: jobTitleError } = await supabase
            .from('profiles')
            .update({ job_title: inviteJobTitle.trim() })
            .eq('id', json.userId)
          if (jobTitleError) console.warn('[invite] job_title update failed:', jobTitleError.message)
        }
        setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail}.` })
        setInviteFirstName(''); setInviteLastName(''); setInviteJobTitle(''); setInviteEmail('')
      }
    } catch {
      setInviteMsg({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' })
    }
    setInviteSending(false)
  }

  function handleMatSchoolClick(schoolId, sName, domainId) {
    setSelectedSchool(schoolId)
    setBrowsingSchoolName(sName)
    setSelectedDomain(domainId ?? '')
    setView('school_readonly')
  }

  function handleBackToMat() {
    setView('mat')
    setSelectedSchool('')
    setSelectedDomain('')
    setBrowsingSchoolName('')
  }

  async function handleCtxSave(updated) {
    if (readOnly) return
    const { error } = await supabase.from('school_context').upsert({
      school_id:    selectedSchool,
      total_pupils: updated.totalPupils,
      pp_count:     updated.ppCount,
      send_count:   updated.sendCount,
      fsm_count:    updated.fsmCount,
      eal_count:    updated.ealCount,
      lac_count:    updated.lacCount,
      wwc_count:    updated.wwcCount,
      social_care_count:           updated.socialCareCount,
      young_carer_count:           updated.youngCarerCount,
      mental_health_support_count: updated.mentalHealthSupportCount,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'school_id' })
    if (error) { console.error('Error saving school context:', error); return }
    setSchoolCtx(updated)
  }

  async function handleFlag(ppId, note) {
    if (readOnly) return false
    const info = ppInfoMap[ppId]
    const { error } = await supabase.from('friction_logs').insert([{
      school_id:          selectedSchool,
      provision_point_id: ppId,
      provision_label:    info?.label ?? '',
      domain_name:        info?.domainName ?? '',
      sub_domain_name:    info?.subDomainName ?? '',
      note:               note ?? '',
    }])
    if (!error) {
      setFlaggedPoints(prev => new Set([...prev, ppId]))
      return true
    }
    console.error('Error saving friction log:', error)
    return false
  }

  // Fast-confirm for static/declarative reminders — stamps date_last_reviewed
  // and advances next_review_due via the shared calculateNextReviewDue, without
  // opening the evidence modal or touching any other field.
  async function handleConfirmStillCurrent(ev) {
    if (isDemoMode || readOnly) return
    const todayIso = new Date().toISOString().slice(0, 10)
    const nextDue = calculateNextReviewDue(ev.reviewCycle, todayIso)
    setConfirmingReviewId(ev.evidenceEntryId)
    setConfirmReviewError(null)
    const { error } = await supabase
      .from('evidence_entries')
      .update({ date_last_reviewed: todayIso, next_review_due: nextDue })
      .eq('id', ev.evidenceEntryId)
    setConfirmingReviewId(null)
    if (error) {
      console.error('Error confirming still current:', error)
      setConfirmReviewError(ev.evidenceEntryId)
      return
    }
    setOverdueReviews(prev => prev.filter(r => r.evidenceEntryId !== ev.evidenceEntryId))
  }

  async function handleModalSave() {
    if (isDemoMode) return
    if (!selectedSchool || !modalPoint) return
    setModalSaving(true)
    setModalSaveMsg(null)

    // Same role-fork the tracker row's status buttons used to apply directly, before status
    // moved into this modal: a contributor choosing In Place never writes status directly —
    // it goes through submit-for-approval instead, below, once the evidence in this same
    // save has been persisted.
    //
    // Exception: for a small allow-list of provision_points.category values (starting with
    // Named Person), a contributor's In Place writes status directly — same as an approver —
    // provided the point's primary evidence field (or Notes) actually has content. An empty
    // allow-listed point still falls through to the normal submit-for-approval path below.
    const chosenStatus = draft.status || null
    const isContributor = userRole === 'contributor'
    const isInPlaceChoice = chosenStatus === 'in_place'
    const primaryDocField = (draft.provision_category ?? '') === 'policy_structural'
      ? 'named_role_policy_document' : 'supporting_document_link'
    const hasPrimaryEvidence = !!((draft[primaryDocField] ?? '').trim() || (draft.notes ?? '').trim())
    const allowsDirectInPlace = DIRECT_INPLACE_CATEGORIES.includes(modalPoint.category) && hasPrimaryEvidence
    const isContributorInPlace = isContributor && isInPlaceChoice && !allowsDirectInPlace

    // Step 1: ensure entries row exists, and write the chosen status directly unless this is
    // the contributor/in_place case (that path never touches status here at all).
    const currentEntry = entries[modalPoint.id] ?? {}
    const entriesPatch = { school_id: selectedSchool, provision_point_id: modalPoint.id, ...currentEntry }
    if (chosenStatus && !isContributorInPlace) {
      entriesPatch.status = chosenStatus
    }
    const { data: entryRow, error: entryError } = await supabase
      .from('entries')
      .upsert([entriesPatch], { onConflict: 'school_id,provision_point_id' })
      .select('id')
      .single()

    if (entryError) {
      setModalSaving(false)
      setModalSaveError(true)
      setModalSaveMsg(entryError.message)
      return
    }

    if (!currentEntry.id) {
      setEntries(prev => ({ ...prev, [modalPoint.id]: { ...prev[modalPoint.id], id: entryRow.id } }))
    }
    if (chosenStatus && !isContributorInPlace) {
      setEntries(prev => ({ ...prev, [modalPoint.id]: { ...prev[modalPoint.id], status: chosenStatus } }))
      setAllStatuses(prev => ({ ...prev, [modalPoint.id]: chosenStatus }))
    }

    // Step 2: insert or update evidence_entry. `status` and `review_cycle` are stripped —
    // status belongs to `entries` (handled above), not a column here at all; review_cycle is
    // being retired from this modal (existing values on old rows are left alone simply by
    // never being included in a payload again, not by being nulled out).
    const { status: _draftStatus, review_cycle: _draftReviewCycle, ...evidenceFields } = draft
    const isExperts = modalPoint.id === EXPERTS_AT_HAND_PP_ID
    const detail = draft.structured_detail ?? {}
    const hasStructuredDetail = isExperts && !!(
      detail.professional_type || detail.commissioning_route || detail.activity_type ||
      (detail.pupils_reached !== null && detail.pupils_reached !== undefined) ||
      detail.report_received === true
    )
    const evidencePayload = isExperts
      ? { ...evidenceFields, evidence_type: hasStructuredDetail ? 'expert_engagement' : 'standard', structured_detail: hasStructuredDetail ? detail : null }
      : evidenceFields

    const { data: saved, error: saveError } = draftId
      ? await supabase.from('evidence_entries').update(evidencePayload).eq('id', draftId).select().single()
      : await supabase.from('evidence_entries').insert([{ entry_id: entryRow.id, ...evidencePayload }]).select().single()

    if (saveError) {
      setModalSaving(false)
      setModalSaveError(true)
      setModalSaveMsg(saveError.message)
      return
    }

    if (draftId) {
      setEvidenceEntries(prev => ({
        ...prev,
        [modalPoint.id]: (prev[modalPoint.id] ?? []).map(e => e.id === draftId ? saved : e),
      }))
    } else {
      setEvidenceEntries(prev => ({
        ...prev,
        [modalPoint.id]: [...(prev[modalPoint.id] ?? []), saved],
      }))
      setDraftId(saved.id)
      setAllEvidenceCounts(prev => ({ ...prev, [modalPoint.id]: (prev[modalPoint.id] ?? 0) + 1 }))
    }

    // Step 3: contributor chose In Place — submit for approval now, atomically with the
    // evidence just saved above (same Save action, not a separate step the user could miss).
    if (isContributorInPlace) {
      const { error: rpcError } = await supabase.rpc('submit_entry_for_approval', {
        p_entry_id: entryRow.id,
        p_submitting_user_id: session.user.id,
      })
      if (rpcError) {
        setModalSaving(false)
        setModalSaveError(true)
        setModalSaveMsg(`Evidence saved, but submitting for approval failed: ${rpcError.message}`)
        return
      }
      setEntries(prev => ({
        ...prev,
        [modalPoint.id]: { ...prev[modalPoint.id], submitted_for_approval_at: new Date().toISOString(), submitted_by: session.user.id },
      }))
    }

    setModalSaving(false)
    setModalSaveError(false)
    setModalSaveMsg(isContributorInPlace ? 'Submitted for approval.' : 'Saved.')
  }

  async function handleModalDelete() {
    if (!draftId || !window.confirm('Delete this evidence entry? This cannot be undone.')) return
    setModalSaving(true)

    const { error } = await supabase.from('evidence_entries').delete().eq('id', draftId)

    setModalSaving(false)
    if (error) {
      setModalSaveError(true)
      setModalSaveMsg(error.message)
    } else {
      setEvidenceEntries(prev => ({
        ...prev,
        [modalPoint.id]: (prev[modalPoint.id] ?? []).filter(e => e.id !== draftId),
      }))
      setAllEvidenceCounts(prev => ({ ...prev, [modalPoint.id]: Math.max(0, (prev[modalPoint.id] ?? 0) - 1) }))
      closeModal()
    }
  }

  function handleOverlayClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) closeModal()
  }

  // Read-only whenever a MAT admin is viewing a school that isn't their own — RLS is the real backstop,
  // this only controls whether the UI shows write controls. Not tied to `view` alone: a MAT admin's own
  // affiliated school (per their profile) stays editable even when reached via the MAT dashboard.
  const readOnly = useIsReadOnlyView(userRole, ownSchoolId, selectedSchool)
  const viewedSchoolName = browsingSchoolName || schoolName
  const isDemoMode = sessionStorage.getItem('isDemoMode') === 'true'

  // Home page principle cards — always whole-school, same as the readiness card above it.
  const { principleData: homePrincipleData, analyticsEntries: homeAnalyticsEntries } = usePrincipleCoverage(supabase, selectedSchool)

  const allPoints = subDomains.flatMap(sd => sd.provision_points)
  const answeredCount = allPoints.filter(p => entries[p.id]?.status).length
  const progress = allPoints.length ? Math.round((answeredCount / allPoints.length) * 100) : 0

  // /demo must be the very first route evaluated — before any auth guard,
  // before authLoading, before the catch-all login form. startsWith handles
  // trailing-slash normalisations (/demo/) added by Vercel or mobile browsers.
  const pathname = pathnameRef.current

  console.log('[App routing] evaluating — pathname:', pathname, '| demoEntry:', sessionStorage.getItem('demoEntry'), '| session:', !!session, '| authLoading:', authLoading, '| userRole:', userRole, '| selectedSchool:', selectedSchool)

  if (pathname.startsWith('/demo')) {
    return <DemoAutoLogin />
  }

  // Public static pages — no auth required
  if (pathname === '/about') return <AboutPage />
  if (pathname === '/privacy') return <PrivacyPage />
  if (pathname === '/admin') return <AdminView />
  if (pathname === '/admin/onboard-school') return <SchoolOnboardingView />

  // Invite-link landing page — also rendered when password_set flag is false (see profile fetch)
  if (pathname.startsWith('/set-password')) return <SetPasswordPage />

  if (authLoading) {
    return <LoadingScreen />
  }

  if (needsPasswordSet && session) return <SetPasswordPage />

  if (passwordExpired) {
    return (
      <div className="login-page">
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
          width: '100%', maxWidth: 440,
          boxShadow: '0 4px 32px rgba(0,0,0,0.09)',
          padding: '48px 40px',
          display: 'flex', flexDirection: 'column',
        }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 28 }}>
            Inclusion Dashboard
          </p>
          <h1 className="login-title" style={{ marginBottom: 12 }}>Your temporary password has expired.</h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
            It's been more than 7 days since it was issued. Ask your school admin to send you a new one.
          </p>
          <a href="/" className="login-btn" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
            Return to sign in
          </a>
        </div>
      </div>
    )
  }

  if (missingProfile && session) {
    return (
      <div className="login-page">
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
          width: '100%', maxWidth: 440,
          boxShadow: '0 4px 32px rgba(0,0,0,0.09)',
          padding: '48px 40px',
          display: 'flex', flexDirection: 'column',
        }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 28 }}>
            Inclusion Dashboard
          </p>
          <h1 className="login-title" style={{ marginBottom: 12 }}>Your account is being set up.</h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
            If this message persists please contact{' '}
            <a href="mailto:hello@inclusiondashboard.co.uk" style={{ color: '#1B365D' }}>
              hello@inclusiondashboard.co.uk
            </a>
          </p>
        </div>
      </div>
    )
  }

  // Demo entry flag: consume and route to MAT dashboard unconditionally.
  // This fires when DemoAutoLogin mounts (setting the flag) and auth settles,
  // guaranteeing /mat-dashboard as the destination regardless of execution order.
  if (session && sessionStorage.getItem('demoEntry') === 'true') {
    console.log('[App routing] demoEntry branch taken — redirecting to /mat-dashboard')
    sessionStorage.removeItem('demoEntry')
    sessionStorage.setItem('isDemoMode', 'true')
    console.log('[App routing] calling window.location.replace(/mat-dashboard)')
    window.location.replace('/mat-dashboard')
    return null
  }

  console.log('[App routing] no demoEntry — normal routing for role:', userRole, '| view:', view)

  // Authenticated user at / → send to dashboard
  if (pathname === '/' && session) {
    window.location.replace('/dashboard')
    return null
  }

  // Unauthenticated user at /dashboard → send to landing page
  if (pathname === '/dashboard' && !session) {
    window.location.replace('/')
    return null
  }

  // Unauthenticated user at / → landing page
  if (pathname === '/' && !session) {
    return <LandingPage />
  }

  // No session on any other path → login form
  if (!session) {
    return (
      <div className="login-page">
        <a href="/" className="login-wordmark">Inclusion Dashboard</a>
        <div className="login-card">
          <div className="login-panel login-panel--signin">
            <h1 className="login-title">Log in to your school's Inclusion Dashboard</h1>
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
              {forgotStatus === 'no-email' && <p className="login-forgot-msg login-forgot-msg--error">Please enter your email address first.</p>}
              {forgotStatus === 'success' && <p className="login-forgot-msg login-forgot-msg--success">Check your inbox — we&apos;ve sent a password reset link.</p>}
              {forgotStatus === 'error' && <p className="login-forgot-msg login-forgot-msg--error">Something went wrong. Please try again.</p>}
              {loginError && <p className="login-error">{loginError}</p>}
              <button type="submit" className="login-btn" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="login-divider" aria-hidden="true" />

          <div className="login-panel login-panel--demo">
            <h2 className="login-demo-title">See the Inclusion Dashboard in action</h2>
            <p className="login-demo-sub">Explore a fully populated demo school to see how the dashboard works before setting up your own.</p>
            <button type="button" className="login-btn-demo" disabled={loginLoading} onClick={handleDemoLogin}>
              {loginLoading ? 'Signing in…' : 'Explore Demo'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {approvalToasts.length > 0 && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 2000,
          display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320,
        }}>
          {approvalToasts.map(t => (
            <div key={t.id} style={{
              background: '#fff', border: '1px solid rgba(37,122,59,0.25)', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <i className="ti ti-circle-check" style={{ color: '#257A3B', fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '0.82rem', color: '#1A202C', margin: 0, flex: 1 }}>
                <strong>{t.label}</strong> was confirmed.
              </p>
              <button type="button" onClick={() => dismissApprovalToast(t.id)} aria-label="Dismiss" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.95rem', padding: 0, flexShrink: 0,
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">Inclusion Dashboard</h1>
          {view === 'mat' && (
            <p className="header-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              MAT Dashboard
              {isFounder && (
                <>
                  <span style={{ color: '#94a3b8' }}>›</span>
                  <button type="button" onClick={() => window.location.replace('/admin')}
                    style={{ background: '#1B365D', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: '6px 14px', borderRadius: 999 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#142845'}
                    onMouseLeave={e => e.currentTarget.style.background = '#1B365D'}
                  >
                    Back to Admin
                  </button>
                </>
              )}
            </p>
          )}
          {view === 'school_readonly' && (
            <p className="header-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={handleBackToMat}
                style={{ background: '#D4751A', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: '6px 14px', borderRadius: 999 }}
                onMouseEnter={e => e.currentTarget.style.background = '#b86215'}
                onMouseLeave={e => e.currentTarget.style.background = '#D4751A'}
              >
                MAT Dashboard
              </button>
              <span style={{ color: '#94a3b8' }}>›</span>
              <span>{browsingSchoolName}</span>
              {selectedDomain && domains.find(d => d.id === selectedDomain) && (
                <>
                  <span style={{ color: '#94a3b8' }}>›</span>
                  <span>{domains.find(d => d.id === selectedDomain).name}</span>
                </>
              )}
            </p>
          )}
        </div>
        {isDemoMode ? (
          <button type="button" className="logout-btn" onClick={async () => {
            await supabase.auth.signOut()
            sessionStorage.clear()
            window.location.replace('/')
          }}>Exit demo</button>
        ) : (
          <button type="button" className="logout-btn" onClick={handleLogout}>Sign out</button>
        )}
      </header>

      {isDemoMode && demoBannerVisible && (
        <DemoBanner onDismiss={() => {
          sessionStorage.setItem('demoBannerDismissed', 'true')
          setDemoBannerVisible(false)
        }} />
      )}

      <div className="app-body" style={{ position: 'relative' }}>
        {/* Backdrop — mobile only, when sidebar is open */}
        {isMobile && sidebarOpen && view !== 'mat' && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }}
          />
        )}

        {/* Sidebar — always on desktop; overlay on mobile when open */}
        {view !== 'mat' && (!isMobile || sidebarOpen) && (
          <div style={isMobile ? {
            position: 'absolute', left: 0, top: 0, height: '100%', zIndex: 100, overflowY: 'auto',
          } : {}}>
            <Sidebar
              domains={domains}
              allSubDomains={allSubDomains}
              ppDomainMap={ppDomainMap}
              allStatuses={allStatuses}
              schoolName={schoolName}
              selectedDomain={selectedDomain}
              setSelectedDomain={setSelectedDomain}
              activeSidebarSection={activeSidebarSection}
              setActiveSidebarSection={setActiveSidebarSection}
              onGenerateReport={() => setSelectedDomain('report-builder')}
              overviewMode={overviewMode}
              selectedCategory={selectedCategory}
              setOverviewMode={setOverviewMode}
              userRole={userRole}
              onInviteUser={() => { openInviteModal(); setSidebarOpen(false) }}
              setSelectedCategory={setSelectedCategory}
              onClose={() => setSidebarOpen(false)}
              flashTeam={sidebarFlashTeam}
              onFlashTeamEnd={() => setSidebarFlashTeam(false)}
            />
          </div>
        )}

        <main className="main">
          {/* Hamburger — mobile only */}
          {isMobile && view !== 'mat' && (
            <button
              type="button"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              style={{
                padding: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--color-background-secondary, #f1f5f9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                alignSelf: 'flex-start', marginBottom: 8, borderRadius: 6,
              }}
            >
              <i className="ti ti-menu-2" style={{ fontSize: 24, lineHeight: 1 }} />
            </button>
          )}

        {view === 'mat' && userMatId && (
          <MATDashboard
            supabase={supabase}
            matId={userMatId}
            onSchoolClick={handleMatSchoolClick}
            isDemoMode={isDemoMode}
          />
        )}

        {/* Demo mode read-only banner — shown when browsing a school from the MAT demo */}
        {isDemoMode && readOnly && (
          <div style={{
            background: '#FEF3C7', borderBottom: '1px solid #FDE68A',
            padding: '8px 0', textAlign: 'center',
            fontSize: '0.8rem', color: '#92400E', fontWeight: 500,
          }}>
            You're viewing a demo school. Changes won't be saved.
          </div>
        )}

        {readOnly && !isDemoMode && (
          <ReadOnlyBanner schoolName={viewedSchoolName} />
        )}

        {view !== 'mat' && selectedSchool && !selectedDomain && (() => {

          // ── Category view ─────────────────────────────────────────────
          if (overviewMode === 'category') {
            if (!selectedCategory) {
              return (
                <div className="dash-grid">
                  {PROVISION_POINT_CATEGORIES.map(cat => {
                    const ppIds   = Object.entries(ppCategoryMap).filter(([, c]) => c === cat).map(([id]) => id)
                    const total   = ppIds.length
                    const inPlace = ppIds.filter(id => allStatuses[id] === 'in_place').length
                    const inProg  = ppIds.filter(id => allStatuses[id] === 'in_progress').length
                    const notIn   = ppIds.filter(id => allStatuses[id] === 'not_in_place').length
                    const answered = inPlace + inProg + notIn
                    const pct     = total ? Math.round((answered / total) * 100) : 0
                    return (
                      <button key={cat} type="button" className="dash-card" onClick={() => setSelectedCategory(cat)}>
                        <h3 className="dash-card-name">{cat}</h3>
                        <div className="dash-progress">
                          <div className="dash-progress-track">
                            <div className="dash-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="dash-progress-label">{answered}/{total}</span>
                        </div>
                        <div className="dash-counts">
                          <span className="dash-count dash-count--green">{inPlace} in place</span>
                          <span className="dash-count dash-count--amber">{inProg} in progress</span>
                          <span className="dash-count dash-count--red">{notIn} not in place</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            }

            // Category detail — provision points grouped by domain
            const catPpIds = Object.entries(ppCategoryMap).filter(([, c]) => c === selectedCategory).map(([id]) => id)

            return (
              <>
                <DrillDownDetail
                  title={selectedCategory}
                  ppIds={catPpIds}
                  domains={domains}
                  ppInfoMap={ppInfoMap}
                  allStatuses={allStatuses}
                  evidenceEntries={evidenceEntries}
                  entries={entries}
                  flaggedPoints={flaggedPoints}
                  expandedDomains={expandedCatDomains}
                  onToggleDomain={toggleDrillDomain}
                  onBack={() => setSelectedCategory(null)}
                  openModal={openModal}
                  readOnly={readOnly}
                  onFlag={handleFlag}
                />
                {/* Evidence-depth heat map — relocated here from the removed Analytics
                    "Provision Depth" tab, for the 4 categories it covers. */}
                {HEAT_CATEGORIES.includes(selectedCategory) && (
                  <div style={{ marginTop: 16 }}>
                    <CategoryHeatmap category={selectedCategory} analyticsEntries={homeAnalyticsEntries} />
                  </div>
                )}
              </>
            )
          }

          // ── Principle view ──────────────────────────────────────────────
          if (overviewMode === 'principle') {
            const principlePpIds = Object.entries(ppPrincipleMap).filter(([, p]) => p === selectedPrinciple).map(([id]) => id)

            return (
              <DrillDownDetail
                title={PRINCIPLE_LABEL_SHORT[selectedPrinciple] ?? selectedPrinciple}
                ppIds={principlePpIds}
                domains={domains}
                ppInfoMap={ppInfoMap}
                allStatuses={allStatuses}
                evidenceEntries={evidenceEntries}
                entries={entries}
                flaggedPoints={flaggedPoints}
                expandedDomains={expandedCatDomains}
                onToggleDomain={toggleDrillDomain}
                onBack={() => { setOverviewMode('domain'); setSelectedPrinciple(null) }}
                openModal={openModal}
                readOnly={readOnly}
                onFlag={handleFlag}
              />
            )
          }

          // ── Home screen ───────────────────────────────────────────────
          const allPpIds   = Object.keys(ppDomainMap)
          const headerCounts = computeCounts(allPpIds.map(id => ({ id })), allStatuses)
          const totTotal    = headerCounts.total
          const totInPlace  = headerCounts.inPlace
          const totInProgress = headerCounts.inProgress
          const readPct    = totTotal ? Math.round((totInPlace / totTotal) * 100) : 0

          const hour     = new Date().getHours()
          const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

          const isPersonalView = viewMode !== 'whole_school'

          // Reviews — filtered to assigned points in personal view
          const filteredReviews = isPersonalView
            ? overdueReviews.filter(r => personalAssignedPpIds.has(r.provisionPointId))
            : overdueReviews
          const reviewsDueCount = filteredReviews.length
          const overdueItems = filteredReviews.filter(r => r.isOverdue)
          const dueSoonItems = filteredReviews.filter(r => !r.isOverdue)

          function renderReviewItem(r, i) {
            const info       = ppInfoMap[r.provisionPointId]
            const domainId   = info?.domainId
            const domainName = info?.domainName ?? ''
            const category   = info?.category ?? ''
            const label      = r.provisionName || info?.label || 'Untitled'
            const dateStr    = new Date(r.nextReviewDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

            const isStatic = STATIC_REVIEW_CATEGORIES.includes(category)
            const isLive   = LIVE_REVIEW_CATEGORIES.includes(category)

            let reminderNode = null
            if (isStatic) {
              const reviewedAgo = formatTimeAgo(r.dateLastReviewed)
              const docLabel    = r.namedRolePolicyDocument || null
              reminderNode = (
                <>
                  {label}{reviewedAgo ? ` was last reviewed ${reviewedAgo}. ` : ' has no recorded review date yet. '}
                  {'Is '}
                  {docLabel && r.supportingDocumentLink ? (
                    <a href={r.supportingDocumentLink} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: '#0f766e', textDecoration: 'underline' }}>{docLabel}</a>
                  ) : (docLabel || 'this')}
                  {' still current?'}
                </>
              )
            } else if (isLive) {
              const loggedAgo = formatTimeAgo(r.dateStarted || r.createdAt)
              const detail    = r.briefDescription || r.structuredDetail?.professional_type || ''
              reminderNode = loggedAgo
                ? `${label} — last logged ${loggedAgo}${detail ? ` (${detail})` : ''}. Has anything happened since?`
                : `${label} — no engagement logged yet for this point.`
            }

            const canConfirm    = isStatic && !readOnly && !isDemoMode && r.reviewCycle && r.reviewCycle !== 'as_needed'
            const isConfirming  = confirmingReviewId === r.evidenceEntryId
            const hasConfirmErr = confirmReviewError === r.evidenceEntryId

            return (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.6)', border: '1px solid #99f6e4', borderRadius: 8,
                padding: '8px 10px', flexShrink: 0,
              }}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => domainId && setSelectedDomain(domainId)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && domainId) setSelectedDomain(domainId) }}
                  style={{ cursor: domainId ? 'pointer' : 'default', textAlign: 'left' }}
                >
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#134e4a', lineHeight: 1.35, marginBottom: 3 }}>
                    {reminderNode ?? label}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.7rem', color: '#0f766e' }}>{domainName}</p>
                    <p style={{ fontSize: '0.7rem', color: r.isOverdue ? '#dc2626' : '#0f766e', fontWeight: 600 }}>{dateStr}</p>
                  </div>
                </div>
                {canConfirm && (
                  <button type="button"
                    onClick={() => handleConfirmStillCurrent(r)}
                    disabled={isConfirming}
                    style={{
                      marginTop: 6, width: '100%', padding: '5px 8px', borderRadius: 6,
                      border: '1px solid #0f766e', background: isConfirming ? '#e2f5f1' : '#fff',
                      color: '#0f766e', fontSize: '0.7rem', fontWeight: 600,
                      cursor: isConfirming ? 'default' : 'pointer', fontFamily: 'inherit',
                    }}>
                    {isConfirming ? 'Confirming…' : 'Confirm still current'}
                  </button>
                )}
                {hasConfirmErr && (
                  <p style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: 4 }}>Couldn't save — try again.</p>
                )}
              </div>
            )
          }

          // Principle cards — always whole-school (see homePrincipleData above), same RAG colouring as before.
          // Fixed DfE order — homePrincipleData is already in PRINCIPLES order from the hook, so no sort here (intentional: never reorder by status).
          const principleCards = homePrincipleData.map(p => {
            const { total, inPlace, inProgress, notInPlace } = p
            let rag = 'untouched'
            if (total > 0) {
              if (notInPlace > 0) rag = 'red'
              else if (inPlace / total >= 0.7) rag = 'green'
              else if (inProgress > 0 || inPlace > 0) rag = 'amber'
            }
            return { ...p, rag }
          })
          const ragBg     = { untouched: '#F7F8FA', red: 'rgba(234,67,53,0.06)', amber: 'rgba(212,117,26,0.08)', green: 'rgba(37,122,59,0.06)' }
          const ragBorder = { untouched: '#E2E8F0', red: 'rgba(234,67,53,0.25)', amber: 'rgba(212,117,26,0.25)', green: 'rgba(37,122,59,0.25)' }

          // Empty personal view — no assignments at all
          const totalAssigned = isPersonalView ? personalAssignedPpIds.size : null

          // Viewing-as label for approver dropdown
          const viewingAsMember = viewMode !== 'whole_school' && viewMode !== 'personal'
            ? teamMembers.find(m => m.id === viewMode)
            : null

          return (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 20,
              background: isPersonalView ? '#F5F4F0' : '#F7F8FA',
              minHeight: '100%', margin: -24, padding: 24,
              transition: 'background 0.25s',
            }}>

              {/* Greeting row + fluid-width readiness box */}
              <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0 }}>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#1A202C', lineHeight: 1.25 }}>
                    {greeting}{firstName ? `, ${firstName}` : ''}.
                  </h1>
                  {schoolName && (
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 3 }}>{schoolName}</p>
                  )}
                </div>

                {/* Overall readiness — always whole-school, fills remaining row width */}
                <div style={{
                  flex: '1 1 320px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: '#1B365D', lineHeight: 1 }}>{readPct}%</span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', paddingBottom: 3 }}>overall readiness</span>
                  </div>
                  <div style={{ flex: '1 1 160px', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 6, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${readPct}%`, background: '#1B365D', borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{totInPlace} of {totTotal} in place</span>
                      {totInProgress > 0 && (
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{totInProgress} in progress</span>
                      )}
                    </div>
                  </div>
                  {(userRole === 'approver' || userRole === 'mat_admin') && approvalQueueCount > 0 && (
                    <button type="button" onClick={() => setApprovalQueueOpen(true)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      padding: '5px 12px', borderRadius: 999, border: '1px solid #FBBF24',
                      background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <i className="ti ti-clipboard-check" style={{ fontSize: '0.85rem' }} />
                      {approvalQueueCount} awaiting approval
                    </button>
                  )}
                </div>
              </div>

              {/* School Context — relocated from the removed Analytics section (was the only
                  place this cohort-profile editor lived); always whole-school, same as the
                  readiness box above it. */}
              <SchoolContextPanel schoolCtx={schoolCtx} onSave={handleCtxSave} ctxLoading={ctxLoading} readOnly={readOnly} />

              {/* View toggle — pill for contributors, dropdown for approvers/mat_admins */}
              {userRole === 'contributor' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', background: '#E2E8F0', borderRadius: 8, padding: 3, gap: 2 }}>
                    {[{ value: 'personal', label: 'My provision' }, { value: 'whole_school', label: 'Whole school' }].map(opt => {
                      const active = viewMode === opt.value
                      return (
                        <button key={opt.value} type="button" onClick={() => setViewMode(opt.value)}
                          style={{
                            padding: '6px 16px', border: 'none', borderRadius: 6,
                            fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                            background: active ? '#fff' : 'transparent',
                            color: active ? '#1A202C' : '#64748b',
                            fontWeight: active ? 600 : 400,
                            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                            transition: 'all 0.12s',
                          }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {!readOnly && !isDemoMode && (
                    <button type="button" onClick={() => setSelfAssignOpen(true)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', border: '1px solid #1B365D', borderRadius: 8,
                      background: '#fff', color: '#1B365D',
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <i className="ti ti-adjustments" style={{ fontSize: '0.9rem' }} />
                      My Provision
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'inherit' }}>Viewing:</label>
                  <select
                    value={viewMode}
                    onChange={e => setViewMode(e.target.value)}
                    style={{
                      padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                      fontSize: '0.82rem', fontFamily: 'inherit', color: '#1A202C',
                      background: '#fff', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="whole_school">Whole school</option>
                    <option value="personal">My provision</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                  {viewingAsMember && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Showing points assigned to {viewingAsMember.first_name}
                    </span>
                  )}
                </div>
              )}

              {/* Empty personal view state — approver browsing a teammate's (viewingAsMember)
                  empty assignment list via the "Viewing:" dropdown only. The contributor's
                  own empty-personal-view message used to live here too, but that moment is
                  now handled by the My Points gate instead (App.jsx's MyPointsQueue mount),
                  so it was removed rather than left to potentially show twice. */}
              {isPersonalView && totalAssigned === 0 && viewingAsMember ? (
                <div style={{
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                  padding: '32px 24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1A202C', marginBottom: 6 }}>
                    No points have been assigned to {viewingAsMember.first_name} yet.
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    Use the Team screen to assign provision points to this person.
                  </p>
                </div>
              ) : (
                <>
              {/* Evaluate & Sustain — collapsed summary tile, expands in place */}
              {reviewsDueCount > 0 && (
                <div style={{ background: '#F0FDFA', border: '1px solid #99f6e4', borderRadius: 12, overflow: 'hidden' }}>
                  <button type="button" onClick={() => setReviewsExpanded(v => !v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                      Evaluate &amp; Sustain —{' '}
                      {[
                        overdueItems.length > 0 ? `${overdueItems.length} overdue` : null,
                        dueSoonItems.length > 0 ? `${dueSoonItems.length} due soon` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                    <i className={`ti ${reviewsExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '0.85rem', color: '#0f766e', flexShrink: 0 }} />
                  </button>
                  {reviewsExpanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <div style={{ overflowY: 'auto', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {overdueItems.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Overdue ({overdueItems.length})
                            </p>
                            {overdueItems.map((r, i) => renderReviewItem(r, `overdue-${i}`))}
                          </div>
                        )}
                        {dueSoonItems.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Due soon ({dueSoonItems.length})
                            </p>
                            {dueSoonItems.map((r, i) => renderReviewItem(r, `due-soon-${i}`))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Principle cards — 7 DfE Principles of Inclusion, fixed DfE order (never reordered by status), fluid width capped at 300px per card.
                  Container max-width is pinned to exactly 4 cards + 3 gaps (4*300 + 3*16 = 1248px) so a 5th card can never join row 1 on very wide monitors — keeps the 4-top/3-bottom structure at every desktop/tablet width, not just one. */}
              <div style={{
                display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'center', gap: 16, width: '100%', maxWidth: isMobile ? '100%' : 1248, margin: '0 auto',
              }}>
                {principleCards.map(p => {
                  const pct = p.total ? Math.round((p.inPlace / p.total) * 100) : 0
                  return (
                    <button key={p.principle} type="button"
                      onClick={() => { setOverviewMode('principle'); setSelectedPrinciple(p.principle) }}
                      style={{
                        background: ragBg[p.rag], border: `1px solid ${ragBorder[p.rag]}`, borderRadius: 12,
                        padding: '16px 18px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        transition: 'box-shadow 0.15s',
                        flex: isMobile ? '1 1 auto' : '1 1 calc(25% - 12px)',
                        width: isMobile ? '100%' : undefined,
                        minWidth: isMobile ? undefined : 160, maxWidth: isMobile ? undefined : 300,
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>
                          {PRINCIPLE_LABEL_SHORT[p.principle] ?? p.principle}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 5 }}>
                          {p.inPlace} of {p.total} complete
                        </p>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#1B365D', borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.inPlace > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#257A3B', background: 'rgba(37,122,59,0.12)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                            {p.inPlace} in place
                          </span>
                        )}
                        {p.inProgress > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#D4751A', background: 'rgba(212,117,26,0.15)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                            {p.inProgress} in progress
                          </span>
                        )}
                        {p.notInPlace > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#EA4335', background: 'rgba(234,67,53,0.12)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                            {p.notInPlace} not in place
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Quiet next-step hint below the principle cards grid — links to the existing Domains and Categories pages, no per-card links. */}
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                See this broken down by:{' '}
                <button type="button"
                  onClick={() => { setSelectedDomain('__domains__') }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                  Domain
                </button>
                {'  |  '}
                <button type="button"
                  onClick={() => { setSelectedDomain(''); setOverviewMode('category'); setSelectedCategory(null) }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                  Category
                </button>
              </div>
              </>
              )}

            </div>
          )
        })()}

        {view !== 'mat' && selectedSchool && selectedDomain === '__domains__' && (() => {
          // Domain cards with RAG triage — scoped to assigned points in personal view.
          // Verbatim extraction of the pre-Session-50 home page domain grid.
          const isPersonalView = viewMode !== 'whole_school'
          const domainCards = domains.map(d => {
            let ppIds = Object.entries(ppDomainMap).filter(([, did]) => did === d.id).map(([id]) => id)
            if (isPersonalView) ppIds = ppIds.filter(id => personalAssignedPpIds.has(id))
            const total      = ppIds.length
            const inPlace    = ppIds.filter(id => allStatuses[id] === 'in_place').length
            const inProgress = ppIds.filter(id => allStatuses[id] === 'in_progress').length
            const notInPlace = ppIds.filter(id => allStatuses[id] === 'not_in_place').length
            const untouched  = ppIds.filter(id => !allStatuses[id]).length
            let rag = 'untouched'
            if (total > 0) {
              if (notInPlace > 0) rag = 'red'
              else if (inPlace / total >= 0.7) rag = 'green'
              else if (inProgress > 0 || inPlace > 0) rag = 'amber'
            }
            return { ...d, total, inPlace, inProgress, notInPlace, untouched, rag }
          })
          const ragOrder    = { untouched: 0, red: 1, amber: 2, green: 3 }
          const sortedDomains = [...domainCards].sort((a, b) => ragOrder[a.rag] - ragOrder[b.rag])
          const ragBg     = { untouched: '#F7F8FA', red: 'rgba(234,67,53,0.06)', amber: 'rgba(212,117,26,0.08)', green: 'rgba(37,122,59,0.06)' }
          const ragBorder = { untouched: '#E2E8F0', red: 'rgba(234,67,53,0.25)', amber: 'rgba(212,117,26,0.25)', green: 'rgba(37,122,59,0.25)' }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {sortedDomains.map(d => {
                const colour = sidebarDomainColour(d.name)
                const pct    = d.total ? Math.round((d.inPlace / d.total) * 100) : 0
                return (
                  <button key={d.id} type="button" onClick={() => setSelectedDomain(d.id)}
                    style={{
                      background: ragBg[d.rag], border: `1px solid ${ragBorder[d.rag]}`, borderRadius: 12,
                      padding: '16px 18px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', gap: 10,
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: colour, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>{d.name}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 5 }}>
                        {d.inPlace} of {d.total} complete
                      </p>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colour, borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.inPlace > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#257A3B', background: 'rgba(37,122,59,0.12)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                          {d.inPlace} in place
                        </span>
                      )}
                      {d.inProgress > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#D4751A', background: 'rgba(212,117,26,0.15)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                          {d.inProgress} in progress
                        </span>
                      )}
                      {d.notInPlace > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#EA4335', background: 'rgba(234,67,53,0.12)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                          {d.notInPlace} not in place
                        </span>
                      )}
                      {d.untouched > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#64748B', background: '#E2E8F0', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                          {d.untouched} untouched
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {view !== 'mat' && selectedSchool && selectedDomain === 'report-builder' && (
          <ReportBuilder
            schoolName={schoolName}
            supabase={supabase}
            school={selectedSchool}
            schoolCtx={schoolCtx}
            onCreateInclusionStrategy={() => setSelectedDomain('inclusion-strategy')}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain === 'team' && (userRole === 'approver' || userRole === 'mat_admin') && (
          <TeamPage
            schoolId={selectedSchool}
            currentUserId={session.user.id}
            matId={userMatId}
            supabase={supabase}
            onInviteUser={openInviteModal}
            readOnly={readOnly}
            userRole={userRole}
          />
        )}

        {bootstrapWizardVisible && session && selectedSchool && userRole === 'approver' && (
          <BootstrapWizard
            schoolId={selectedSchool}
            schoolName={schoolName}
            userId={session.user.id}
            firstName={firstName}
            matId={userMatId}
            supabase={supabase}
            onDismiss={() => setBootstrapWizardVisible(false)}
          />
        )}

        {/* My Points gate — auto-shows for a contributor who hasn't dismissed it yet
            (profiles.welcomed === false), and is also reachable directly at /my-points (the
            route SetPasswordPage now redirects new colleagues to, replacing the old
            accidental /home fallthrough, which matched no real route at all). Rendered here,
            inside the same tree as the evidence modal below (not as an early return), so
            opening that modal from the queue reuses it completely unmodified — no
            extraction, no new modal component. */}
        {session && selectedSchool && userRole === 'contributor' && !myPointsGateBypassed && (!welcomed || pathname.startsWith('/my-points')) && (
          <MyPointsQueue
            schoolId={selectedSchool}
            userId={session.user.id}
            firstName={firstName}
            supabase={supabase}
            openModal={openModal}
            closeModal={closeModal}
            modalPoint={modalPoint}
            modalSaveMsg={modalSaveMsg}
            modalSaveError={modalSaveError}
            onExit={handleMyPointsExit}
          />
        )}

        {/* Only offered once the bootstrap wizard is out of the way this session — the two
            first-login flows would otherwise compete for the same moment. */}
        {!bootstrapWizardVisible && firstLoginPromptVisible && session && selectedSchool && userRole === 'approver' && (
          <OnboardingPrompt
            onboardingState={onboardingState}
            userId={session.user.id}
            firstName={firstName}
            schoolId={selectedSchool}
            supabase={supabase}
            onClose={({ flash }) => {
              setFirstLoginPromptVisible(false)
              if (flash) setSidebarFlashTeam(true)
            }}
            onGoToTeam={() => {
              setFirstLoginPromptVisible(false)
              setSelectedDomain('team')
            }}
          />
        )}

        {selfAssignOpen && selectedSchool && (
          <AssignmentModal
            person={{ id: session.user.id, first_name: firstName || 'Me', last_name: '', role: userRole }}
            schoolId={selectedSchool}
            currentUserId={session.user.id}
            supabase={supabase}
            onClose={() => setSelfAssignOpen(false)}
            onSaved={loadPersonalAssignedPpIds}
          />
        )}

        {approvalQueueOpen && selectedSchool && (
          <ApprovalQueueModal
            schoolId={selectedSchool}
            currentUserId={session.user.id}
            supabase={supabase}
            isDemoMode={isDemoMode}
            onClose={() => setApprovalQueueOpen(false)}
            onActioned={(ppId, patch) => {
              setEntries(prev => ({ ...prev, [ppId]: { ...prev[ppId], ...patch } }))
              if (patch.status) setAllStatuses(prev => ({ ...prev, [ppId]: patch.status }))
              loadApprovalQueueCount()
            }}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain === 'barriers' && (
          <BarriersView
            school={selectedSchool}
            supabase={supabase}
            domains={domains}
            readOnly={readOnly}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain === 'inclusion-strategy' && (
          <InclusionStrategyWizard
            school={selectedSchool}
            schoolName={schoolName}
            supabase={supabase}
            domains={domains}
            readOnly={readOnly}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain && selectedDomain !== 'analytics' && selectedDomain !== 'report-builder' && selectedDomain !== 'team' && selectedDomain !== 'barriers' && selectedDomain !== 'inclusion-strategy' && selectedDomain !== '__domains__' && (
          loading ? (
            <p className="state-msg">Loading…</p>
          ) : subDomains.length === 0 ? (
            <p className="state-msg">No provision points found for this domain.</p>
          ) : (() => {
            const currentDomain = domains.find(d => d.id === selectedDomain)
            const domColour = currentDomain ? sidebarDomainColour(currentDomain.name) : '#64748b'
            const domInPlace = allPoints.filter(p => entries[p.id]?.status === 'in_place').length
            const domTotal = allPoints.length
            const domPct = domTotal ? Math.round((domInPlace / domTotal) * 100) : 0
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Domain header */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: domColour, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1A202C' }}>{currentDomain?.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{domInPlace} of {domTotal} in place</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${domPct}%`, background: domColour, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>

                {/* Universal / Targeted filter */}
                <div style={{ display: 'flex', gap: 4, background: '#E2E8F0', borderRadius: 8, padding: 3, alignSelf: 'flex-start', marginBottom: 12 }}>
                  {[['all', 'All'], ['universal', 'Universal'], ['targeted', 'Targeted']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setUtFilter(val)} style={{
                      padding: '5px 14px', border: 'none', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: utFilter === val ? 600 : 400,
                      color:      utFilter === val ? '#1A202C' : '#64748b',
                      background: utFilter === val ? '#fff' : 'transparent',
                      boxShadow:  utFilter === val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}>{label}</button>
                  ))}
                </div>

                {/* Sub-domain sections — every point in the sub-domain renders directly, no
                    truncation (Phase 0 confirmed sub-domain sizes are tightly clustered at
                    4-11 points, unlike the Category/Principle drill-down's much wider spread,
                    so there's no outlier case to design truncation around here). */}
                {subDomains.map(sd => {
                  const pps = utFilter === 'all'
                    ? sd.provision_points
                    : sd.provision_points.filter(p => p.universal_or_targeted === utFilter)
                  const ppCount = pps.length
                  if (ppCount === 0) return null
                  const sdInPlace   = pps.filter(p => entries[p.id]?.status === 'in_place').length
                  const sdInProg    = pps.filter(p => entries[p.id]?.status === 'in_progress').length
                  const sdUntouched = pps.filter(p => !entries[p.id]?.status).length

                  return (
                    <div key={sd.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                      {/* Section header — static, nothing left to expand/collapse */}
                      <div style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '11px 16px', borderBottom: '0.5px solid #e2e8f0',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A202C' }}>{sd.name}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 2 }}>({ppCount})</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#334155' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#257A3B', display: 'inline-block', flexShrink: 0 }} />
                            {sdInPlace}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#334155' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4751A', display: 'inline-block', flexShrink: 0 }} />
                            {sdInProg}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
                            {sdUntouched}
                          </span>
                        </div>
                      </div>

                      {/* Provision point rows — all of them, always */}
                      <div>
                        {pps.map((pp, ppIdx) => (
                          <ProvisionPointRow
                            key={pp.id}
                            pp={pp}
                            ppIdx={ppIdx}
                            status={entries[pp.id]?.status}
                            evidenceList={evidenceEntries[pp.id] ?? []}
                            onOpenModal={openModal}
                            readOnly={readOnly}
                            isFlagged={flaggedPoints.has(pp.id)}
                            onFlag={handleFlag}
                            submittedAt={entries[pp.id]?.submitted_for_approval_at}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()
        )}
        </main>
      </div>

      {modalPoint && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" ref={modalRef} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2 className="modal-title">{modalPoint.label}</h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {modalPoint.universal_or_targeted && (
              <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Provision type</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                  background: modalPoint.universal_or_targeted === 'universal' ? '#DBEAFE' : '#EDE9FE',
                  color:      modalPoint.universal_or_targeted === 'universal' ? '#1E40AF' : '#5B21B6',
                  whiteSpace: 'nowrap',
                }}>
                  {modalPoint.universal_or_targeted === 'universal' ? 'Universal' : 'Targeted'}
                </span>
              </div>
            )}

            <div className="modal-body">
              {(() => {
                const currentEntry = entries[modalPoint.id] ?? {}
                const isPending = !!currentEntry.submitted_for_approval_at
                return (isPending || currentEntry.send_back_note) && (
                  <div style={{
                    margin: '0 20px 16px', padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(212,117,26,0.08)', border: '1px solid rgba(212,117,26,0.3)',
                  }}>
                    {isPending && (
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400E', margin: 0 }}>
                        Pending approval — submitted, waiting for an approver to confirm.
                      </p>
                    )}
                    {currentEntry.send_back_note && (
                      <p style={{ fontSize: '0.8rem', color: '#78350F', margin: isPending ? '6px 0 0' : 0 }}>
                        Sent back previously with a note: &ldquo;{currentEntry.send_back_note}&rdquo;
                      </p>
                    )}
                  </div>
                )
              })()}
              <div className="detail-grid">
                {(() => {
                  const currentEntry = entries[modalPoint.id] ?? {}
                  const isPending = !!currentEntry.submitted_for_approval_at
                  const fieldsDisabled = readOnly || isPending
                  const showExpanded = modalExpanded || isPending

                  const cat = draft.provision_category ?? ''
                  const isStudentFacing  = cat === 'student_facing'
                  const isPolicyStruct   = cat === 'policy_structural'
                  const isWholeSchool    = cat === 'whole_school'
                  const isLegacy         = cat === ''
                  const showReach        = isStudentFacing || isWholeSchool
                  const showCost         = isStudentFacing || isWholeSchool || isLegacy
                  const showOutcomes     = isStudentFacing || isWholeSchool || isLegacy
                  const showSecondaryDoc = isPolicyStruct || isLegacy

                  // Primary doc field per category (Phase 0/1 decision): named_role_policy_document
                  // only for policy_structural; supporting_document_link for everything else
                  // (student_facing, whole_school, legacy, and — since it's never anything but
                  // student_facing in practice — Experts at Hand).
                  const primaryDocField = isPolicyStruct ? 'named_role_policy_document' : 'supporting_document_link'
                  const secondaryDocField = isPolicyStruct ? 'supporting_document_link' : 'named_role_policy_document'
                  const primaryDocLabel = primaryDocField === 'named_role_policy_document' ? 'Named Role / Policy / Document' : 'Supporting Document Link'
                  const secondaryDocLabel = secondaryDocField === 'named_role_policy_document' ? 'Named Role / Policy / Document' : 'Supporting Document Link'

                  const reachInputStyle = { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem', width: '100%' }

                  return (
                    <>
                      {/* ── Default (always-visible): Title, Provision Type, Status, primary document, next review due ── */}
                      <div className="df df--half">
                        <label>Title</label>
                        <input type="text" value={draft.provision_name ?? ''} onChange={e => handleDraftChange('provision_name', e.target.value)} disabled={fieldsDisabled} />
                      </div>

                      <div className="df df--half">
                        <label>Provision Type</label>
                        <select value={cat} onChange={e => handleDraftChange('provision_category', e.target.value)} disabled={fieldsDisabled}>
                          <option value="">— Select type —</option>
                          {PROVISION_CATEGORIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      <div className="df df--half">
                        <label>Status</label>
                        <select value={draft.status ?? ''} onChange={e => handleStatusSelect(e.target.value)} disabled={fieldsDisabled}>
                          <option value="">— Select status —</option>
                          <option value="not_in_place">Not in Place</option>
                          <option value="in_progress">In Progress</option>
                          <option value="in_place">In Place</option>
                        </select>
                      </div>

                      <div className="df df--half">
                        <label>{primaryDocLabel}</label>
                        {primaryDocField === 'supporting_document_link' ? (
                          <input type="url" placeholder="https://…" value={draft.supporting_document_link ?? ''} onChange={e => handleDraftChange('supporting_document_link', e.target.value)} disabled={fieldsDisabled} />
                        ) : (
                          <input type="text" value={draft.named_role_policy_document ?? ''} onChange={e => handleDraftChange('named_role_policy_document', e.target.value)} disabled={fieldsDisabled} />
                        )}
                      </div>

                      <div className="df df--half">
                        <label>Next Review Due</label>
                        <input type="date" value={draft.next_review_due ?? ''} onChange={e => handleDraftChange('next_review_due', e.target.value || null)} disabled={fieldsDisabled} />
                      </div>

                      {!isPending && (
                        <div className="df df--full">
                          <button type="button" onClick={() => setModalExpanded(v => !v)} style={{
                            background: 'none', border: 'none', padding: 0, color: '#1B365D',
                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}>
                            {modalExpanded ? '– Hide extra fields' : '+ Add more'}
                          </button>
                        </div>
                      )}

                      {showExpanded && (
                        <>
                          {/* ── All except policy: brief description ── */}
                          {!isPolicyStruct && (
                            <div className="df df--full">
                              <label>Brief Description</label>
                              <textarea rows={2} value={draft.brief_description ?? ''} onChange={e => handleDraftChange('brief_description', e.target.value)} disabled={fieldsDisabled} />
                            </div>
                          )}

                          {/* ── Student-Facing: SEND tiers ── */}
                          {(isStudentFacing || isLegacy) && (
                            <div className="df df--half">
                              <label>SEND Tiers</label>
                              <div className="tier-checkbox-group">
                                {SEND_TIERS.map(t => {
                                  const selected = Array.isArray(draft.send_tiers) ? draft.send_tiers : []
                                  const checked = selected.includes(t.value)
                                  return (
                                    <label key={t.value} className="tier-checkbox-label">
                                      <input type="checkbox" checked={checked} disabled={fieldsDisabled} onChange={() => {
                                        const next = checked ? selected.filter(v => v !== t.value) : [...selected, t.value]
                                        handleDraftChange('send_tiers', next)
                                      }} />
                                      {t.label}
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Delivered By ── */}
                          <div className="df df--half">
                            <label>Delivered By</label>
                            <input type="text" value={draft.delivered_by ?? ''} onChange={e => handleDraftChange('delivered_by', e.target.value)} disabled={fieldsDisabled} />
                          </div>

                          {/* ── Experts at Hand: structured expert-engagement detail ── */}
                          {modalPoint.id === EXPERTS_AT_HAND_PP_ID && (() => {
                            const detail = draft.structured_detail ?? {}
                            function handleDetailChange(field, value) {
                              handleDraftChange('structured_detail', { ...detail, [field]: value })
                            }
                            return (
                              <>
                                <div className="df df--half">
                                  <label>Professional Type</label>
                                  <select value={detail.professional_type ?? ''} onChange={e => handleDetailChange('professional_type', e.target.value)} disabled={fieldsDisabled}>
                                    <option value="">— Select type —</option>
                                    {EXPERT_PROFESSIONAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </select>
                                </div>
                                <div className="df df--half">
                                  <label>Commissioning Route</label>
                                  <select value={detail.commissioning_route ?? ''} onChange={e => handleDetailChange('commissioning_route', e.target.value)} disabled={fieldsDisabled}>
                                    <option value="">— Select route —</option>
                                    {EXPERT_COMMISSIONING_ROUTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                  </select>
                                </div>
                                <div className="df df--half">
                                  <label>Activity Type</label>
                                  <select value={detail.activity_type ?? ''} onChange={e => handleDetailChange('activity_type', e.target.value)} disabled={fieldsDisabled}>
                                    <option value="">— Select activity —</option>
                                    {EXPERT_ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                  </select>
                                </div>
                                <div className="df df--quarter">
                                  <label>Pupils Reached</label>
                                  <input type="number" min="0" step="1" disabled={fieldsDisabled}
                                    value={detail.pupils_reached ?? ''}
                                    onChange={e => handleDetailChange('pupils_reached', e.target.value === '' ? null : Number(e.target.value))} />
                                </div>
                                <div className="df df--quarter" style={{ justifyContent: 'flex-end' }}>
                                  <label className="tier-checkbox-label" style={{ marginTop: 'auto', marginBottom: 6 }}>
                                    <input type="checkbox" checked={detail.report_received ?? false} disabled={fieldsDisabled}
                                      onChange={e => handleDetailChange('report_received', e.target.checked)} />
                                    Written Report Received
                                  </label>
                                </div>
                              </>
                            )
                          })()}

                          {/* ── Student Reach numbers ── */}
                          {showReach && (
                            <div className="df df--full">
                              <label>
                                Students Reached
                                {isWholeSchool && <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.75rem', marginLeft: 6 }}>(optional)</span>}
                              </label>
                              {isStudentFacing && <span className="field-hint">Group counts can overlap — a student may belong to multiple groups</span>}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 12px', marginTop: 8 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total</label>
                                  <input type="number" min="0" step="1" style={reachInputStyle} disabled={fieldsDisabled}
                                    value={draft.reach_total ?? ''}
                                    onChange={e => handleDraftChange('reach_total', e.target.value === '' ? null : Number(e.target.value))} />
                                </div>
                                {REACH_GROUPS.map(g => (
                                  <div key={g.field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{g.label}</label>
                                    <input type="number" min="0" step="1" style={reachInputStyle} disabled={fieldsDisabled}
                                      value={draft[g.field] ?? ''}
                                      onChange={e => handleDraftChange(g.field, e.target.value === '' ? null : Number(e.target.value))} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ── Legacy: old checkboxes + pupils_reached ── */}
                          {isLegacy && (
                            <>
                              <div className="df df--half">
                                <label>Student Groups</label>
                                <div className="tier-checkbox-group">
                                  {EV_GROUPS.map(g => (
                                    <label key={g.value} className="tier-checkbox-label">
                                      <input type="checkbox" checked={draft[g.value] ?? false} disabled={fieldsDisabled} onChange={e => handleDraftChange(g.value, e.target.checked)} />
                                      {g.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div className="df df--quarter">
                                <label>Pupils / People Reached</label>
                                <input type="number" min="0" step="1" disabled={fieldsDisabled}
                                  value={draft.pupils_reached ?? ''}
                                  onChange={e => handleDraftChange('pupils_reached', e.target.value === '' ? null : Number(e.target.value))} />
                              </div>
                            </>
                          )}

                          {/* ── Cost & funding ── */}
                          {showCost && (
                            <>
                              <div className="df df--quarter">
                                <label>Annual Cost £</label>
                                <input type="number" min="0" step="1" disabled={fieldsDisabled}
                                  value={draft.cost ?? ''}
                                  onChange={e => handleDraftChange('cost', e.target.value === '' ? null : Number(e.target.value))} />
                              </div>
                              <div className="df df--half">
                                <label>Funding Source</label>
                                <select value={draft.funding_source ?? ''} onChange={e => handleDraftChange('funding_source', e.target.value)} disabled={fieldsDisabled}>
                                  <option value="">—</option>
                                  {FUNDING_SOURCES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                              </div>
                            </>
                          )}

                          {/* ── Date fields (Next Review Due is now a default field above, not here) ── */}
                          <div className="df df--half">
                            <label>Date Provision Started</label>
                            <input type="date" value={draft.date_started ?? ''} onChange={e => handleDraftChange('date_started', e.target.value || null)} disabled={fieldsDisabled} />
                          </div>
                          <div className="df df--half">
                            <label>Date Last Evaluated &amp; Sustained</label>
                            <input type="date" value={draft.date_last_reviewed ?? ''} onChange={e => handleDraftChange('date_last_reviewed', e.target.value || null)} disabled={fieldsDisabled} />
                          </div>

                          {/* ── Intended outcomes ── */}
                          {showOutcomes && (
                            <div className="df df--full">
                              <label>Intended Outcomes</label>
                              {isStudentFacing && <span className="field-hint">What barriers are you aiming to remove for this group?</span>}
                              <textarea rows={3} value={draft.intended_outcomes ?? ''} onChange={e => handleDraftChange('intended_outcomes', e.target.value)} disabled={fieldsDisabled} />
                            </div>
                          )}

                          {/* ── Impact on outcomes (student-facing + legacy) ── */}
                          {(isStudentFacing || isLegacy) && (
                            <div className="df df--full">
                              <label>Impact on Outcomes</label>
                              <textarea rows={3} value={draft.impact_on_outcomes ?? ''} onChange={e => handleDraftChange('impact_on_outcomes', e.target.value)} disabled={fieldsDisabled} />
                            </div>
                          )}

                          {/* ── Evidence / implementation evidence ── */}
                          {(isStudentFacing || isWholeSchool || isLegacy) && (
                            <div className="df df--full">
                              <label>{isWholeSchool ? 'Implementation Evidence' : 'Evidence of Impact'}</label>
                              <textarea rows={3} value={draft.evidence_notes ?? ''} onChange={e => handleDraftChange('evidence_notes', e.target.value)} disabled={fieldsDisabled} />
                            </div>
                          )}

                          {/* ── Secondary document field — whichever one isn't the category's default ── */}
                          {showSecondaryDoc && (
                            <div className="df df--full">
                              <label>{secondaryDocLabel}</label>
                              {secondaryDocField === 'supporting_document_link' ? (
                                <input type="url" placeholder="https://…" value={draft.supporting_document_link ?? ''} onChange={e => handleDraftChange('supporting_document_link', e.target.value)} disabled={fieldsDisabled} />
                              ) : (
                                <input type="text" value={draft.named_role_policy_document ?? ''} onChange={e => handleDraftChange('named_role_policy_document', e.target.value)} disabled={fieldsDisabled} />
                              )}
                            </div>
                          )}

                          <div className="df df--full">
                            <label>Notes</label>
                            <textarea rows={2} value={draft.notes ?? ''} onChange={e => handleDraftChange('notes', e.target.value)} disabled={fieldsDisabled} />
                          </div>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>

            {(() => {
              const currentEntry = entries[modalPoint.id] ?? {}
              const isPending = !!currentEntry.submitted_for_approval_at
              return (
                <div className="modal-footer">
                  {draftId && !readOnly && !isPending && (
                    <button type="button" className="delete-btn" onClick={handleModalDelete} disabled={modalSaving}>
                      Delete
                    </button>
                  )}
                  <div className="modal-footer-right">
                    {readOnly && (
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>Read only — viewing {browsingSchoolName}</span>
                    )}
                    {!readOnly && isPending && (
                      <span style={{ fontSize: '0.78rem', color: '#92400E', fontStyle: 'italic' }}>Pending approval — no changes until an approver actions it.</span>
                    )}
                    {!readOnly && !isPending && modalSaveMsg && (
                      <span className={`save-msg${modalSaveError ? ' save-msg--error' : ' save-msg--ok'}`}>
                        {modalSaveMsg}
                      </span>
                    )}
                    <button type="button" className="modal-cancel-btn" onClick={closeModal}>Close</button>
                    {!readOnly && !isPending && (
                      <button type="button" className="save-btn" onClick={handleModalSave} disabled={modalSaving}>
                        {modalSaving ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      )}

      {/* Invite user modal */}
      {inviteOpen && (
        <div
          className="modal-overlay"
          onClick={e => { if (inviteModalRef.current && !inviteModalRef.current.contains(e.target)) closeInviteModal() }}
        >
          <div className="modal" ref={inviteModalRef} role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Invite a colleague</h2>
              <button type="button" className="modal-close" onClick={closeInviteModal} aria-label="Close">✕</button>
            </div>

            <form className="modal-body" onSubmit={handleInviteSubmit}>
              <div className="detail-grid">
                <div className="df df--half">
                  <label htmlFor="invite-first-name">First name</label>
                  <input
                    id="invite-first-name"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="Sarah"
                    value={inviteFirstName}
                    onChange={e => { setInviteFirstName(e.target.value); setInviteMsg(null) }}
                  />
                </div>
                <div className="df df--half">
                  <label htmlFor="invite-last-name">Last name</label>
                  <input
                    id="invite-last-name"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="Jones"
                    value={inviteLastName}
                    onChange={e => { setInviteLastName(e.target.value); setInviteMsg(null) }}
                  />
                </div>
                <div className="df df--full">
                  <label htmlFor="invite-job-title">Role / position</label>
                  <input
                    id="invite-job-title"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="e.g. SENCO, Assistant Headteacher"
                    value={inviteJobTitle}
                    onChange={e => { setInviteJobTitle(e.target.value); setInviteMsg(null) }}
                  />
                </div>
                <div className="df df--full">
                  <label htmlFor="invite-email">Email address</label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="colleague@school.org"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteMsg(null) }}
                  />
                </div>
              </div>

              {inviteMsg && (
                <p style={{
                  marginTop: 12, fontSize: '0.82rem', lineHeight: 1.5,
                  color: inviteMsg.type === 'success' ? '#166534' : '#991b1b',
                  background: inviteMsg.type === 'success' ? 'rgba(37,122,59,0.08)' : 'rgba(234,67,53,0.08)',
                  border: `1px solid ${inviteMsg.type === 'success' ? 'rgba(37,122,59,0.3)' : 'rgba(234,67,53,0.3)'}`,
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  {inviteMsg.text}
                </p>
              )}

              <div className="modal-footer" style={{ marginTop: 20 }}>
                <div className="modal-footer-right">
                  <button type="button" className="modal-cancel-btn" onClick={closeInviteModal}>
                    Cancel
                  </button>
                  <button type="submit" className="save-btn" disabled={inviteSending}>
                    {inviteSending ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
