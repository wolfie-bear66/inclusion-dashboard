import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import MATDashboard from './MATDashboard'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import TeamPage from './pages/TeamPage'
import InclusionStrategyWizard from './pages/InclusionStrategyWizard'
import OnboardingPrompt from './components/OnboardingPrompt'
import ApprovalQueueModal from './components/ApprovalQueueModal'
import AssignmentModal from './components/AssignmentModal'
import SetPasswordPage from './pages/SetPasswordPage'
import AdminView from './pages/AdminView'
import { useIsReadOnlyView } from './hooks/useIsReadOnlyView'
import ReadOnlyBanner from './components/ReadOnlyBanner'
import './App.css'
import { generateEvidenceReport, generateReport, generateInclusionStrategy } from './generateReport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

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
const REVIEW_CYCLES = [
  { value: 'weekly',      label: 'Weekly' },
  { value: 'half_termly', label: 'Half-termly' },
  { value: 'termly',      label: 'Termly' },
  { value: 'annual',      label: 'Annual' },
  { value: 'as_needed',   label: 'As needed' },
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
// Static/declarative points: reminder copy names the linked document and asks if it's still current.
const STATIC_REVIEW_CATEGORIES = ['Named Person', 'Policy / Published Document']
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

const A_GROUPS = [
  { key: 'grp_pp',   label: 'Pupil Premium' },
  { key: 'grp_send', label: 'SEND' },
  { key: 'grp_fsm',  label: 'FSM' },
  { key: 'grp_eal',  label: 'EAL' },
  { key: 'grp_lac',  label: 'LAC' },
  { key: 'grp_wwc',  label: 'White Working Class' },
  { key: 'grp_social_care',           label: 'Social Care' },
  { key: 'grp_young_carer',           label: 'Young Carer' },
  { key: 'grp_mental_health_support', label: 'Mental Health Support' },
]

const FUNDING_LABELS_MAP = {
  pupil_premium:             'Pupil Premium',
  send_budget:               'SEND Budget',
  inclusive_mainstream_fund: 'IMF',
  sport_premium:             'Sport Premium',
  school_general_budget:     'General Budget',
}

const ANALYTICS_TABS = [
  { id: 'readiness',  label: 'Domain Readiness' },
  { id: 'principle',  label: 'Principle Coverage' },
  { id: 'equity',     label: 'Provision Depth' },
  { id: 'funding',    label: 'Funding & Cost' },
  { id: 'outcomes',   label: 'Outcomes & Impact' },
]

const PRINCIPLES = [
  'Leadership & Governance',
  'Early & Evidence-Based Support',
  'High Quality Adaptive Teaching',
  'Enriching Provision',
  'Safe & Respectful Culture',
  'Family & Wider Partnerships',
  'Accessible & Inclusive Environments',
]

const RAG_COLOURS = { in_place: '#257A3B', in_progress: '#D4751A', not_in_place: '#EA4335' }

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
  setAnalyticsTabRequest,
  onGenerateReport,
  analyticsTabRequest,
  overviewMode, selectedCategory,
  setOverviewMode, setSelectedCategory,
  onClose,
  userRole, onInviteUser,
  flashTeam, onFlashTeamEnd,
}) {
  const totalPP   = Object.keys(ppDomainMap).length
  const answered  = Object.values(allStatuses).filter(Boolean).length

  const isHome    = !selectedDomain
  const isReport  = selectedDomain === 'report-builder'
  const isDomain  = (id) => selectedDomain === id
  const isAnalytics = selectedDomain === 'analytics'
  const isAnalyticsTab = (id) => isAnalytics && analyticsTabRequest === id

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
          onClick: () => { setSelectedDomain(''); setAnalyticsTabRequest(null); setOverviewMode('domain'); setSelectedCategory(null); onClose() } })}

        {/* Domains */}
        {expanderBtn({
          id: 'domains-expander', icon: 'ti-layout-grid', label: 'Domains',
          open: activeSidebarSection === 'domains', onToggle: () => setActiveSidebarSection(prev => prev === 'domains' ? null : 'domains'),
          active: !!(selectedDomain && selectedDomain !== 'analytics' && selectedDomain !== '__report__' && activeSidebarSection !== 'domains'),
        })}
        {activeSidebarSection === 'domains' && domains.map(d => {
          const colour = sidebarDomainColour(d.name)
          const active = isDomain(d.id)
          const isH = hovered === `domain-${d.id}`
          return (
            <button key={d.id} type="button"
              onMouseEnter={() => setHovered(`domain-${d.id}`)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { setSelectedDomain(d.id); setAnalyticsTabRequest(null); onClose() }}
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
              onClick={() => { setSelectedDomain(''); setAnalyticsTabRequest(null); setOverviewMode('category'); setSelectedCategory(cat); onClose() }}
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

        {/* Analytics */}
        {expanderBtn({
          id: 'analytics-expander', icon: 'ti-chart-bar', label: 'Analytics',
          open: activeSidebarSection === 'analytics', onToggle: () => setActiveSidebarSection(prev => prev === 'analytics' ? null : 'analytics'),
          active: isAnalytics,
        })}
        {activeSidebarSection === 'analytics' && ANALYTICS_TABS.map(t => {
          const active = isAnalyticsTab(t.id)
          const isH = hovered === `atab-${t.id}`
          return (
            <button key={t.id} type="button"
              onMouseEnter={() => setHovered(`atab-${t.id}`)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { setSelectedDomain('analytics'); setAnalyticsTabRequest(t.id); onClose() }}
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
              {t.label}
            </button>
          )
        })}

        {/* Barriers */}
        {navBtn({
          id: 'barriers', icon: 'ti-alert-triangle',
          label: 'Barriers',
          active: selectedDomain === 'barriers',
          onClick: () => { setSelectedDomain('barriers'); setAnalyticsTabRequest(null); onClose() },
        })}

        {/* Create Inclusion Strategy */}
        {navBtn({
          id: 'inclusion-strategy', icon: 'ti-clipboard-text',
          label: 'Create Inclusion Strategy',
          active: selectedDomain === 'inclusion-strategy',
          onClick: () => { setSelectedDomain('inclusion-strategy'); setAnalyticsTabRequest(null); onClose() },
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
              onClick: () => { setSelectedDomain('team'); setAnalyticsTabRequest(null); onClose() },
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

  async function handleGeneratePdf() {
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
        sb.from('domains').select('id, name, display_order').order('display_order'),
        sb.from('barriers')
          .select('id, description, status, actions, scale, student_groups, domain_id, sub_domain_id, next_review_due, domains(name), sub_domains(name)')
          .eq('school_id', school),
        userId
          ? sb.from('profiles').select('first_name, last_name, job_title').eq('id', userId).single()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (entriesRes.error) throw new Error(`Entries: ${entriesRes.error.message}`)
      if (domainsRes.error) throw new Error(`Domains: ${domainsRes.error.message}`)

      generateEvidenceReport({
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
      })
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <p style={{ fontSize: '0.78rem', color: '#64748b', flex: 1, minWidth: 0 }}>
            {purpose === 'full_strategy' ? 'Inclusion Strategy Statement' : 'Inclusion Evidence Report'}
            {' — '}
            {domainLabel}
            {selectedGroups.length > 0 ? ` · ${groupLabel}` : ''}
          </p>
          <button type="button" onClick={handleGeneratePdf} disabled={generating || !generateEnabled} style={{
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

function DomainReadiness({ readinessData, upcomingReviews }) {
  const grandTotal   = readinessData.reduce((s, d) => s + d.total, 0)
  const grandInPlace = readinessData.reduce((s, d) => s + d.inPlace, 0)
  const overallPct   = grandTotal ? Math.round((grandInPlace / grandTotal) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ACard>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1B365D', lineHeight: 1 }}>{overallPct}%</span>
          <div style={{ paddingBottom: 6 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C' }}>Overall readiness</p>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{grandInPlace} of {grandTotal} indicators In Place</p>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: '#E2E8F0', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${overallPct}%`, borderRadius: 6, background: '#1B365D', transition: 'width 0.5s' }} />
        </div>
      </ACard>

      {readinessData.length > 0 && (
        <ACard>
          <ASectionTitle sub="Status breakdown across provision points per domain">By Domain</ASectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {readinessData.map((d, i) => {
              const pctIn  = d.total ? Math.round((d.inPlace    / d.total) * 100) : 0
              const pctProg = d.total ? Math.round((d.inProgress / d.total) * 100) : 0
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A202C' }}>{d.fullName}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {d.inPlace} in place · {d.inProgress} in progress · {d.notInPlace} not started
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#E2E8F0', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctIn + pctProg}%`, background: d.colour, opacity: 0.2, borderRadius: 4 }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctIn}%`, background: d.colour, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ACard>
      )}

      {upcomingReviews.length > 0 && (
        <ACard>
          <ASectionTitle sub="Evidence entries with an evaluate &amp; sustain date within the next 60 days">Compliance Forecast</ASectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingReviews.map((ev, i) => {
              const bg  = ev.urgency === 'urgent' ? 'rgba(234,67,53,0.08)' : ev.urgency === 'soon' ? 'rgba(212,117,26,0.10)' : '#F7F8FA'
              const col = ev.urgency === 'urgent' ? '#dc2626' : ev.urgency === 'soon' ? '#d97706' : '#475569'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: bg }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A202C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.provision_name || ev.entryLabel}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>{ev.domainName}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(ev.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: col, marginTop: 1 }}>
                      {ev.daysLeft <= 0 ? 'Overdue' : `${ev.daysLeft}d left`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ACard>
      )}
    </div>
  )
}

function CircleProgress({ label, count, denominator, onClick }) {
  const pct = denominator ? Math.round((count / denominator) * 100) : 0
  const R = 40
  const W = 9
  const circumference = 2 * Math.PI * R
  const filled = (pct / 100) * circumference
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 16px', cursor: 'pointer', fontFamily: 'inherit',
      flex: 1, minWidth: 0, transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B365D'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(27,54,93,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={R} fill="none" stroke="#E2E8F0" strokeWidth={W} />
        <circle cx={50} cy={50} r={R} fill="none" stroke="#1B365D" strokeWidth={W}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={46} textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight={700} fill="#1B365D">{pct}%</text>
        <text x={50} y={63} textAnchor="middle" fontSize={10} fill="#94a3b8">{count}/{denominator}</text>
      </svg>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1A202C', textAlign: 'center', lineHeight: 1.35, margin: 0 }}>{label}</p>
    </button>
  )
}

function ProvisionDepth({ analyticsEntries, domains, onNavigateToCategory }) {
  const [domainFilter, setDomainFilter] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  const filteredEntries = domainFilter
    ? analyticsEntries.filter(e => (e.provision_points?.sub_domains?.domains?.name ?? '') === domainFilter)
    : analyticsEntries

  function countCoveredPPs(category) {
    return new Set(
      filteredEntries
        .filter(e => (e.provision_points?.category ?? '') === category && (e.evidence_entries ?? []).length > 0)
        .map(e => e.provision_point_id)
    ).size
  }

  const CIRCLES = [
    { label: 'Named Person',                category: 'Named Person',                denominator: 10 },
    { label: 'Policy / Published Document', category: 'Policy / Published Document', denominator: 7  },
    { label: 'Monitoring & Data',           category: 'Monitoring & Data',           denominator: 18 },
  ]

  const HEAT_CATEGORIES = [
    'Staff Training & CPD',
    'External Partnership',
    'Family & Community Engagement',
    'Direct Provision for Students',
  ]

  const DOMAIN_ORDER = [
    'SEND Support & Needs',
    'Equity & Disadvantage',
    'Attendance & Engagement',
    'Enrichment',
    'Belonging',
    'Wellbeing',
  ]

  function cellColour(count) {
    if (count === 0) return '#E5E7EB'
    if (count === 1) return '#C7D9EE'
    if (count === 2) return '#8FB8D8'
    if (count <= 4)  return '#4A7FA8'
    return '#1B365D'
  }

  function heatGroupsForCategory(category) {
    const catEntries = filteredEntries.filter(e => (e.provision_points?.category ?? '') === category)
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
    return DOMAIN_ORDER.filter(d => byDomain[d]).map(d => ({ domain: d, points: byDomain[d] }))
  }

  const pillBase = { fontSize: 12, padding: '5px 12px', borderRadius: 99, cursor: 'pointer', border: '0.5px solid #e2e8f0', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {/* Domain filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[null, ...domains.map(d => d.name)].map((dn, i) => {
          const active = domainFilter === dn
          return (
            <button key={i} type="button" onClick={() => setDomainFilter(dn)}
              style={{ ...pillBase,
                background: active ? 'rgba(27,54,93,0.10)' : '#F0F2F5',
                color: active ? '#1B365D' : '#64748B',
                border: `0.5px solid ${active ? '#1B365D' : '#e2e8f0'}`,
                fontWeight: active ? 600 : 400,
              }}>
              {dn ?? 'All'}
            </button>
          )
        })}
      </div>

      {/* Completion circles */}
      <div style={{ display: 'flex', gap: 16 }}>
        {CIRCLES.map(c => (
          <CircleProgress
            key={c.category}
            label={c.label}
            count={countCoveredPPs(c.category)}
            denominator={c.denominator}
            onClick={() => onNavigateToCategory?.(c.category)}
          />
        ))}
      </div>

      {/* Heat map grids — one per category */}
      {HEAT_CATEGORIES.map(cat => {
        const groups = heatGroupsForCategory(cat)
        const totalPoints = groups.reduce((sum, g) => sum + g.points.length, 0)
        return (
          <ACard key={cat}>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 2 }}>{cat}</p>
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
                        <div
                          key={idx}
                          onMouseEnter={e => {
                            const r = e.currentTarget.getBoundingClientRect()
                            setTooltip({ x: r.right + 6, y: r.top, name: pt.name, domain: pt.domain, count: pt.count })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            width: 28, height: 28, borderRadius: 4,
                            background: cellColour(pt.count),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'default', flexShrink: 0,
                          }}
                        >
                          {pt.count >= 5 && (
                            <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, lineHeight: 1 }}>{pt.count}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ACard>
        )
      })}

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: '#1A202C', color: '#fff',
          padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem',
          pointerEvents: 'none', zIndex: 9999, maxWidth: 220, lineHeight: 1.5,
        }}>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.name}</p>
          <p style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{tooltip.domain}</p>
          <p style={{ fontSize: '0.68rem' }}>{tooltip.count} entr{tooltip.count === 1 ? 'y' : 'ies'}</p>
        </div>
      )}
    </div>
  )
}

const FUNDING_FULL_LABELS = {
  pupil_premium:             'Pupil Premium',
  send_budget:               'SEND Budget',
  inclusive_mainstream_fund: 'Inclusive Mainstream Fund',
  sport_premium:             'Sport Premium',
  school_general_budget:     'School General Budget',
}

const FUNDING_SOURCE_ORDER = [
  'pupil_premium',
  'send_budget',
  'inclusive_mainstream_fund',
  'sport_premium',
  'school_general_budget',
]

function FundingCost({ analyticsEntries }) {
  // ── Derive Panel 1: funding source breakdown ──────────────────────
  const sourceMap = {}  // key → { ppIds: Set, cost: number }
  for (const entry of analyticsEntries) {
    const ppId = entry.provision_point_id
    for (const ev of entry.evidence_entries ?? []) {
      if (!ev.funding_source) continue
      const k = ev.funding_source
      if (!sourceMap[k]) sourceMap[k] = { ppIds: new Set(), cost: 0 }
      sourceMap[k].ppIds.add(ppId)
      sourceMap[k].cost += Number(ev.cost) || 0
    }
  }

  const sourceData = FUNDING_SOURCE_ORDER
    .filter(k => sourceMap[k])
    .map(k => ({
      key:   k,
      label: FUNDING_FULL_LABELS[k] ?? k,
      short: k === 'inclusive_mainstream_fund' ? 'IMF'
           : k === 'school_general_budget'     ? 'General Budget'
           : FUNDING_FULL_LABELS[k] ?? k,
      count: sourceMap[k].ppIds.size,
      cost:  sourceMap[k].cost,
    }))

  const hasAnyFunding = sourceData.length > 0

  // ── Derive Panel 2: IMF by principle ─────────────────────────────
  const imfByPrinciple = {}  // principle → { ppIds: Set, cost: number }
  for (const entry of analyticsEntries) {
    const ppId     = entry.provision_point_id
    const principle = entry.provision_points?.principle
    if (!principle) continue
    for (const ev of entry.evidence_entries ?? []) {
      if (ev.funding_source !== 'inclusive_mainstream_fund') continue
      if (!imfByPrinciple[principle]) imfByPrinciple[principle] = { ppIds: new Set(), cost: 0 }
      imfByPrinciple[principle].ppIds.add(ppId)
      imfByPrinciple[principle].cost += Number(ev.cost) || 0
    }
  }

  const imfPrincipleData = PRINCIPLES.map(p => ({
    principle: p,
    count: imfByPrinciple[p]?.ppIds.size ?? 0,
    cost:  imfByPrinciple[p]?.cost ?? 0,
  }))
  const imfTotal     = imfPrincipleData.reduce((s, r) => s + r.count, 0)
  const imfCostTotal = imfPrincipleData.reduce((s, r) => s + r.cost, 0)
  const hasImf       = imfTotal > 0

  // chart data: short label so axis fits
  const chartData = sourceData.map(s => ({ name: s.short, count: s.count, cost: s.cost }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Panel 1 ── */}
      <ACard>
        <ASectionTitle sub="Count of provision points and total cost per funding stream">Provision by Funding Source</ASectionTitle>

        {!hasAnyFunding ? (
          <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>
            No funding data recorded yet. Add funding sources when evidencing provision points.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 60)}>
              <BarChart data={chartData} layout="vertical" barCategoryGap="25%" barGap={4}
                margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
                <XAxis xAxisId="count" type="number" allowDecimals={false}
                  tick={{ fontSize: 10 }} tickFormatter={v => String(v)} />
                <XAxis xAxisId="cost" type="number" orientation="top"
                  tick={{ fontSize: 10 }} tickFormatter={v => v === 0 ? '' : `£${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Provisions'
                      ? [`${value} provision${value !== 1 ? 's' : ''}`, 'Provisions']
                      : [`£${Number(value).toLocaleString()}`, 'Total Cost']
                  }
                />
                <Bar xAxisId="count" dataKey="count" name="Provisions" fill="#1B365D" radius={[0,3,3,0]} barSize={10} />
                <Bar xAxisId="cost"  dataKey="cost"  name="Total Cost"  fill="#5B7FA6" radius={[0,3,3,0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>

            {/* Summary table */}
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>Funding Source</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>Provisions</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#F7F8FA' }}>
                      <td style={{ padding: '8px 10px', color: '#1A202C', fontWeight: 500 }}>{s.label}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1B365D', fontWeight: 600 }}>{s.count}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1A202C' }}>
                        {s.cost > 0 ? `£${s.cost.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ACard>

      {/* ── Divider ── */}
      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* ── Panel 2 ── */}
      <ACard>
        <ASectionTitle sub="The IMF is tied to the 7 DfE Principles of Inclusion. This breakdown shows how your IMF-funded provision is distributed across each principle.">
          Inclusive Mainstream Fund — Spend by Principle
        </ASectionTitle>

        {!hasImf ? (
          <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>
            No Inclusive Mainstream Fund spend recorded yet. Tag evidence entries with 'Inclusive Mainstream Fund' as the funding source to track spend here.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>Principle</th>
                  <th style={{ textAlign: 'center', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>IMF Provisions</th>
                  <th style={{ textAlign: 'right', padding: '7px 10px', color: '#64748b', fontWeight: 600 }}>IMF Cost</th>
                </tr>
              </thead>
              <tbody>
                {imfPrincipleData.map((row, i) => {
                  const muted = row.count === 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#F7F8FA' }}>
                      <td style={{ padding: '8px 10px', color: muted ? '#9CA3AF' : '#1A202C', fontWeight: muted ? 400 : 500 }}>{row.principle}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: muted ? '#9CA3AF' : '#1B365D', fontWeight: muted ? 400 : 600 }}>
                        {muted ? '—' : row.count}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: muted ? '#9CA3AF' : '#1A202C' }}>
                        {row.cost > 0 ? `£${row.cost.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ borderTop: '2px solid #E2E8F0', background: 'rgba(27,54,93,0.04)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1A202C' }}>Total IMF</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#1B365D' }}>{imfTotal}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1A202C' }}>
                    {imfCostTotal > 0 ? `£${imfCostTotal.toLocaleString()}` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ACard>

    </div>
  )
}

// Domain × group evidenced-outcomes matrix — default view of the Outcomes & Impact tab.
// Cell = count of allEvidence rows in that domain, tagged grp_<group> = true, with a
// non-empty impact_on_outcomes (tagged alone doesn't count — must be evidenced).
// New component rather than resurrecting the dead GroupReach (App.jsx, below) — GroupReach's
// purpose was cohort % reach, this is evidenced-impact count; different data, same table
// + overflowX:auto structural pattern.
function outcomesMatrixCellStyle(count) {
  if (count === 0) return { background: '#FEF2F2', color: '#B91C1C' }
  if (count === 1) return { background: '#C7D9EE', color: '#1A202C' }
  if (count === 2) return { background: '#8FB8D8', color: '#1A202C' }
  if (count <= 4) return { background: '#4A7FA8', color: '#FFFFFF' }
  return { background: '#1B365D', color: '#FFFFFF' }
}

function OutcomesMatrix({ matrix, leastRepresented, onCellClick, onViewFullList }) {
  return (
    <ACard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <ASectionTitle sub="Evidenced outcomes by domain and student group — click a cell to see the entries behind it">
          Outcomes & Impact
        </ASectionTitle>
        <button
          type="button"
          onClick={onViewFullList}
          style={{ fontSize: '0.78rem', color: '#1B365D', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: '4px 0', fontFamily: 'inherit' }}
        >
          View full list →
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px 4px', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Domain</th>
              {matrix[0]?.cells?.map(c => (
                <th key={c.groupKey} style={{ padding: '4px 6px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.domainId}>
                <td style={{ padding: '4px 8px', fontWeight: 500, color: '#1A202C', whiteSpace: 'nowrap' }}>{row.domain}</td>
                {row.cells.map(c => (
                  <td
                    key={c.groupKey}
                    onClick={() => onCellClick(row.domainId, row.domain, c.field, c.groupKey, c.label)}
                    style={{
                      padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                      borderRadius: 4, fontWeight: 600, minWidth: 32,
                      ...outcomesMatrixCellStyle(c.count),
                    }}
                  >
                    {c.count}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leastRepresented.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 14 }}>
          <strong style={{ color: '#1A202C' }}>Least represented in evidenced outcomes:</strong>{' '}
          {leastRepresented.map(g => `${g.label} (${g.total} ${g.total === 1 ? 'entry' : 'entries'})`).join(', ')}
        </p>
      )}
    </ACard>
  )
}

function OutcomesImpact({ allEvidence, domains, analyticsEntries }) {
  const [filterMode, setFilterMode] = useState('all')
  const [activeFilters, setActiveFilters] = useState([])
  const [view, setView] = useState('matrix') // 'matrix' | 'list'
  const [cellFilter, setCellFilter] = useState(null) // { domainId, domainName, field, groupKey, groupLabel }

  const allItems = allEvidence
    .filter(ev => ev.intended_outcomes || ev.impact_on_outcomes || ev.evidence_notes || ev.evidence_type === 'expert_engagement')
    .map(ev => {
      const dIdx = domains.findIndex(d => d.id === ev.domainId)
      const isExpertEngagement = ev.evidence_type === 'expert_engagement'
      return {
        name:      ev.provision_name || ev.entryLabel,
        point:     ev.entryLabel,
        domain:    ev.domainName,
        domainId:  ev.domainId,
        subDomain: ev.subDomainName,
        colour:    dIdx >= 0 ? aDomainColour(ev.domainName, dIdx) : '#94a3b8',
        groups:    A_GROUPS.filter(g => ev[g.key]).map(g => g.label),
        // Independent of A_GROUPS (which omits "Other") — used only for matrix drill-down
        // matching, so all 10 REACH_GROUPS columns (including Other) work correctly.
        groupKeys: REACH_GROUPS.map(g => g.field.replace('reach_', 'grp_')).filter(k => ev[k]),
        intended:  ev.intended_outcomes,
        impact:    ev.impact_on_outcomes,
        docLink:   ev.supporting_document_link || null,
        expertEngagement: isExpertEngagement ? ev.structured_detail ?? {} : null,
      }
    })

  const unassignedPPs = (analyticsEntries ?? [])
    .filter(e => (e.evidence_entries ?? []).length === 0)
    .map(e => ({
      label:     e.provision_points?.label ?? 'Unknown',
      domain:    e.provision_points?.sub_domains?.domains?.name ?? '',
      subDomain: e.provision_points?.sub_domains?.name ?? '',
    }))

  const domainOptions    = [...new Set(allItems.map(i => i.domain).filter(Boolean))]
  const groupOptions     = [...new Set(allItems.flatMap(i => i.groups).filter(Boolean))]
  const subDomainOptions = [...new Set(allItems.map(i => i.subDomain).filter(Boolean))]

  const showUnassigned = activeFilters.includes('Unassigned')
  const nonUnassignedFilters = activeFilters.filter(f => f !== 'Unassigned')

  const filteredItems = cellFilter
    ? allItems.filter(i => i.domain === cellFilter.domainName && i.groupKeys.includes(cellFilter.groupKey))
    : filterMode === 'all' || nonUnassignedFilters.length === 0
      ? allItems
      : filterMode === 'domain'
        ? allItems.filter(i => nonUnassignedFilters.includes(i.domain))
        : filterMode === 'group'
          ? allItems.filter(i => i.groups.some(g => nonUnassignedFilters.includes(g)))
          : allItems.filter(i => nonUnassignedFilters.includes(i.subDomain))

  const pillOptions = filterMode === 'domain' ? domainOptions : filterMode === 'group' ? groupOptions : subDomainOptions

  function setMode(mode) { setFilterMode(mode); setActiveFilters([]) }
  function toggleFilter(val) {
    setActiveFilters(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  // ── Domain × group evidenced-outcomes matrix (default view) ──
  const outcomesMatrix = domains.map(d => ({
    domainId: d.id,
    domain: d.name,
    cells: REACH_GROUPS.map(g => {
      const grpKey = g.field.replace('reach_', 'grp_')
      const count = allEvidence.filter(ev =>
        ev.domainId === d.id && ev[grpKey] && ev.impact_on_outcomes?.trim()
      ).length
      return { field: g.field, groupKey: grpKey, label: g.label, count }
    }),
  }))

  const leastRepresented = REACH_GROUPS
    .filter(g => g.field !== 'reach_other')
    .map(g => {
      const grpKey = g.field.replace('reach_', 'grp_')
      return {
        label: g.label,
        groupKey: grpKey,
        total: outcomesMatrix.reduce((s, row) => s + (row.cells.find(c => c.groupKey === grpKey)?.count ?? 0), 0),
      }
    })
    .sort((a, b) => a.total - b.total)
    .slice(0, 2)

  function openCell(domainId, domainName, field, groupKey, groupLabel) {
    setCellFilter({ domainId, domainName, field, groupKey, groupLabel })
    setActiveFilters([])
    setView('list')
  }
  function backToMatrix() {
    setCellFilter(null)
    setView('matrix')
  }
  function viewFullList() {
    setCellFilter(null)
    setFilterMode('all')
    setActiveFilters([])
    setView('list')
  }

  const modePills = [
    { id: 'all',       label: 'All' },
    { id: 'domain',    label: 'By Domain' },
    { id: 'group',     label: 'By Group' },
    { id: 'subdomain', label: 'By Sub-domain' },
  ]

  const pillBase = {
    fontSize: 12, padding: '5px 12px', borderRadius: 99, cursor: 'pointer',
    border: '0.5px solid #e2e8f0', fontFamily: 'inherit',
  }
  const pillInactive = { background: '#F0F2F5', color: '#64748B' }
  const pillActive   = { background: 'rgba(27,54,93,0.10)', color: '#1B365D', border: '0.5px solid #1B365D' }

  const displayCount  = showUnassigned && nonUnassignedFilters.length === 0 ? 0 : filteredItems.length
  const displayTotal  = allItems.length
  const showPrompt    = filterMode !== 'all' && activeFilters.length === 0

  if (allItems.length === 0 && unassignedPPs.length === 0) return (
    <ACard>
      <ASectionTitle sub="Intended outcomes and evidence of impact">Outcomes & Impact</ASectionTitle>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No outcomes or impact data recorded yet.</p>
    </ACard>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {view === 'matrix' && (
        <OutcomesMatrix
          matrix={outcomesMatrix}
          leastRepresented={leastRepresented}
          onCellClick={openCell}
          onViewFullList={viewFullList}
        />
      )}

      {view === 'list' && (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={backToMatrix}
          style={{ fontSize: '0.78rem', color: '#1B365D', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
          ← Back to matrix
        </button>
        {cellFilter && (
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Filtered: <strong style={{ color: '#1A202C' }}>{cellFilter.domainName}</strong> × <strong style={{ color: '#1A202C' }}>{cellFilter.groupLabel}</strong>
          </span>
        )}
      </div>

      {!cellFilter && (
      <div>
        {/* Filter controls */}
        {/* Mode toggle pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {modePills.map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              style={{ ...pillBase, ...(filterMode === m.id ? pillActive : pillInactive) }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Filter option pills */}
        {filterMode !== 'all' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
            {pillOptions.map(opt => (
              <button key={opt} type="button" onClick={() => toggleFilter(opt)}
                style={{ ...pillBase, ...(activeFilters.includes(opt) ? pillActive : pillInactive) }}>
                {opt}
              </button>
            ))}
            <button type="button" onClick={() => toggleFilter('Unassigned')}
              style={{ ...pillBase, ...(showUnassigned ? pillActive : pillInactive) }}>
              Unassigned
            </button>
            {activeFilters.length > 0 && (
              <button type="button" onClick={() => setActiveFilters([])}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#1B365D', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 4px' }}>
                Clear
              </button>
            )}
          </div>
        )}

        {/* Summary banner */}
        {showPrompt ? (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Select one or more filters above</p>
        ) : (
          <div style={{ background: 'rgba(27,54,93,0.06)', borderRadius: 8, padding: '10px 16px', display: 'inline-flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1B365D', lineHeight: 1 }}>
              {filterMode === 'all' ? displayTotal : displayCount}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {filterMode === 'all'
                ? `outcome${displayTotal !== 1 ? 's' : ''} recorded`
                : `of ${displayTotal} outcome${displayTotal !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>
      )}

      {cellFilter && (
        <div style={{ background: 'rgba(27,54,93,0.06)', borderRadius: 8, padding: '10px 16px', display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1B365D', lineHeight: 1 }}>{filteredItems.length}</span>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>outcome{filteredItems.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {(!showUnassigned || nonUnassignedFilters.length > 0) && filteredItems.map((item, i) => (
        <ACard key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: item.intended || item.impact ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.colour, flexShrink: 0, marginTop: 4 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>{item.name}</p>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                  {item.domain}{item.subDomain ? ` · ${item.subDomain}` : ''}
                </p>
              </div>
            </div>
            {item.groups.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '45%', marginLeft: 12 }}>
                {item.groups.map((g, gi) => <AGroupPill key={gi} label={g} />)}
              </div>
            )}
          </div>
          {item.intended && (
            <div style={{ marginBottom: item.impact ? 10 : 0 }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Intended outcome</p>
              <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>{item.intended}</p>
            </div>
          )}
          {item.impact && (
            <div style={{ marginBottom: item.docLink || item.expertEngagement ? 10 : 0 }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Evidence of impact</p>
              <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>{item.impact}</p>
            </div>
          )}
          {item.expertEngagement && (() => {
            const { professional_type, pupils_reached } = item.expertEngagement
            const prof = EXPERT_PROFESSIONAL_REPORT_LABEL[professional_type]
            if (!prof && !pupils_reached) return null
            const pupilsPhrase = pupils_reached
              ? `${pupils_reached} pupil${pupils_reached === 1 ? '' : 's'} received direct ${prof?.input ?? 'specialist input'}`
              : null
            return (
              <div style={{ marginBottom: item.docLink ? 10 : 0 }}>
                <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>
                  {item.name}{prof ? ` — ${prof.name}` : ''}{pupilsPhrase ? ` — ${pupilsPhrase}` : ''}
                </p>
              </div>
            )
          })()}
          {item.docLink && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Supporting Document</p>
              <a
                href={item.docLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none',
                  fontWeight: 500, padding: '5px 10px', borderRadius: 6,
                  border: '1px solid #bfdbfe', background: '#eff6ff',
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                title={item.docLink}
              >
                <span style={{ flexShrink: 0 }}>↗</span>
                {(() => {
                  try {
                    const u = new URL(item.docLink)
                    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.split('/').pop() || u.pathname : '')
                  } catch { return item.docLink }
                })()}
              </a>
            </div>
          )}
        </ACard>
      ))}

      {showUnassigned && unassignedPPs.length > 0 && (
        <ACard>
          <ASectionTitle sub="Provision points with no evidence entries recorded">Untouched provision points</ASectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unassignedPPs.map((pp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, background: '#F7F8FA' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '0.82rem', color: '#1A202C' }}>{pp.label}</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>{pp.domain}{pp.subDomain ? ` · ${pp.subDomain}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </ACard>
      )}

      {showUnassigned && unassignedPPs.length === 0 && (
        <ACard>
          <p style={{ fontSize: '0.85rem', color: '#257A3B' }}>All provision points have at least one evidence entry.</p>
        </ACard>
      )}
      </>
      )}
    </div>
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

function PrincipleCoverage({ principleData }) {
  const LABEL_SHORT = {
    'Leadership & Governance':          'Leadership',
    'Early & Evidence-Based Support':   'Early Support',
    'High Quality Adaptive Teaching':   'Adaptive Teaching',
    'Enriching Provision':              'Enriching Provision',
    'Safe & Respectful Culture':        'Safe Culture',
    'Family & Wider Partnerships':      'Family Partnerships',
    'Accessible & Inclusive Environments': 'Accessible Envs',
  }

  const chartData = principleData.map(p => ({
    name: LABEL_SHORT[p.principle] ?? p.principle,
    fullName: p.principle,
    in_place: p.inPlace,
    in_progress: p.inProgress,
    not_in_place: p.notInPlace,
    total: p.total,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ACard>
        <ASectionTitle sub="RAG status breakdown for each of the 7 DfE Principles of Inclusion">Principle Coverage</ASectionTitle>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => [value, STATUS_LABELS[name] ?? name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="in_place"    name="in_place"    stackId="a" fill={RAG_COLOURS.in_place}    />
              <Bar dataKey="in_progress" name="in_progress" stackId="a" fill={RAG_COLOURS.in_progress} />
              <Bar dataKey="not_in_place" name="not_in_place" stackId="a" fill={RAG_COLOURS.not_in_place} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {[['in_place','In Place'],['in_progress','In Progress'],['not_in_place','Not In Place']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: RAG_COLOURS[key], display: 'inline-block' }} />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</span>
            </div>
          ))}
        </div>
      </ACard>

      <ACard>
        <ASectionTitle sub="Points in place, in progress, not in place, and percentage complete per principle">Summary by Principle</ASectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>Principle</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>Total</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: RAG_COLOURS.in_place, fontWeight: 600 }}>In Place</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: RAG_COLOURS.in_progress, fontWeight: 600 }}>In Progress</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: RAG_COLOURS.not_in_place, fontWeight: 600 }}>Not In Place</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: '#1B365D', fontWeight: 600 }}>% Complete</th>
              </tr>
            </thead>
            <tbody>
              {principleData.map((p, i) => {
                const pct = p.total ? Math.round((p.inPlace / p.total) * 100) : 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#F7F8FA' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 500, color: '#1A202C' }}>{p.principle}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>{p.total}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: RAG_COLOURS.in_place, fontWeight: 600 }}>{p.inPlace}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: RAG_COLOURS.in_progress, fontWeight: 600 }}>{p.inProgress}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: RAG_COLOURS.not_in_place, fontWeight: 600 }}>{p.notInPlace}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      <span style={{
                        background: pct >= 70 ? 'rgba(37,122,59,0.12)' : pct >= 40 ? 'rgba(212,117,26,0.12)' : 'rgba(234,67,53,0.10)',
                        color: pct >= 70 ? RAG_COLOURS.in_place : pct >= 40 ? RAG_COLOURS.in_progress : RAG_COLOURS.not_in_place,
                        padding: '2px 8px', borderRadius: 20, fontWeight: 700, fontSize: '0.78rem',
                      }}>{pct}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ACard>
    </div>
  )
}

function AnalyticsView({ school, supabase: sb, schoolName = '', tabRequest = null, schoolCtx, onSave, ctxLoading, onNavigateToCategory, readOnly = false }) {
  const [analyticsEntries, setAnalyticsEntries] = useState([])
  const [domains, setDomains] = useState([])
  const [allActivePPs, setAllActivePPs] = useState([])
  const [aLoading, setALoading] = useState(true)
  const [activeTab, setActiveTab] = useState('readiness')

  useEffect(() => {
    if (tabRequest) setActiveTab(tabRequest)
  }, [tabRequest])

  useEffect(() => {
    setALoading(true)
    Promise.all([
      sb.from('entries')
        .select(`
          id, provision_point_id, status,
          grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
          provision_points(*, sub_domains(*, domains(id, name))),
          evidence_entries(id, provision_name, indicator_type, provision_category, funding_source, cost, next_review_due,
            evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link,
            reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc,
            reach_social_care, reach_young_carer, reach_mental_health_support, reach_other,
            grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc,
            grp_social_care, grp_young_carer, grp_mental_health_support, grp_other, evidence_type, structured_detail)
        `)
        .eq('school_id', school),
      sb.from('domains').select('id, name, display_order').order('display_order'),
      sb.from('provision_points').select('id, principle, display_order').eq('active', true),
    ]).then(([entriesRes, domainsRes, ppsRes]) => {
      if (entriesRes.error) console.error('Analytics entries error:', entriesRes.error)
      if (domainsRes.error) console.error('Analytics domains error:', domainsRes.error)
      setAnalyticsEntries(entriesRes.data ?? [])
      setDomains(domainsRes.data ?? [])
      setAllActivePPs(ppsRes.data ?? [])
      setALoading(false)
    })
  }, [school])

  // Domain readiness
  const readinessData = domains.map((d, idx) => {
    const de = analyticsEntries.filter(e => e.provision_points?.sub_domains?.domains?.id === d.id)
    return {
      name: d.name.length > 14 ? d.name.split(/[&\s]/)[0] : d.name,
      fullName: d.name,
      colour: aDomainColour(d.name, idx),
      inPlace:    de.filter(e => e.status === 'in_place').length,
      inProgress: de.filter(e => e.status === 'in_progress').length,
      notInPlace: de.filter(e => e.status === 'not_in_place').length,
      total: de.length,
    }
  })

  // Principle Coverage — join active PPs with entry statuses
  const entryStatusMap = Object.fromEntries(analyticsEntries.map(e => [e.provision_point_id, e.status]))
  const principleData = PRINCIPLES.map(principle => {
    const pps = allActivePPs.filter(pp => pp.principle === principle)
    const inPlace    = pps.filter(pp => entryStatusMap[pp.id] === 'in_place').length
    const inProgress = pps.filter(pp => entryStatusMap[pp.id] === 'in_progress').length
    const notInPlace = pps.filter(pp => !entryStatusMap[pp.id] || entryStatusMap[pp.id] === 'not_in_place').length
    return { principle, total: pps.length, inPlace, inProgress, notInPlace }
  })

  // Flatten all evidence entries with domain context
  const allEvidence = analyticsEntries.flatMap(e =>
    (e.evidence_entries ?? []).map(ev => ({
      ...ev,
      entryLabel:    e.provision_points?.label ?? '',
      domainId:      e.provision_points?.sub_domains?.domains?.id,
      domainName:    e.provision_points?.sub_domains?.domains?.name ?? '',
      subDomainName: e.provision_points?.sub_domains?.name ?? '',
    }))
  )

  // Upcoming reviews
  const today = new Date()
  const upcomingReviews = allEvidence
    .filter(ev => ev.next_review_due)
    .map(ev => {
      const daysLeft = Math.ceil((new Date(ev.next_review_due) - today) / 86400000)
      return { ...ev, daysLeft, urgency: daysLeft <= 7 ? 'urgent' : daysLeft <= 21 ? 'soon' : 'upcoming' }
    })
    .filter(ev => ev.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Funding
  const fundingBySource = {}
  const fundingByDomain = {}
  for (const ev of allEvidence) {
    const cost = Number(ev.cost)
    if (!cost) continue
    if (ev.funding_source) {
      const label = FUNDING_LABELS_MAP[ev.funding_source] ?? ev.funding_source
      fundingBySource[label] = (fundingBySource[label] ?? 0) + cost
    }
    if (ev.domainName) {
      fundingByDomain[ev.domainName] = (fundingByDomain[ev.domainName] ?? 0) + cost
    }
  }
  const fundingSourceData = Object.entries(fundingBySource).map(([name, value]) => ({ name, value }))
  const fundingDomainData = Object.entries(fundingByDomain).map(([name, value], idx) => ({
    name: name.length > 14 ? name.split(/[&\s]/)[0] : name,
    fullName: name, value,
    colour: aDomainColour(name, idx),
  }))
  const totalCost = fundingSourceData.reduce((s, d) => s + d.value, 0)

  // Outcomes
  const outcomesData = domains
    .map((d, idx) => ({
      domain: d.name,
      colour: aDomainColour(d.name, idx),
      items: allEvidence
        .filter(ev => ev.domainId === d.id && (ev.intended_outcomes || ev.impact_on_outcomes || ev.evidence_notes))
        .map(ev => ({
          point:        ev.entryLabel,
          provisionName: ev.provision_name,
          groups: A_GROUPS.filter(g => ev[g.key]).map(g => g.label),
          intended: ev.intended_outcomes,
          impact:   ev.impact_on_outcomes,
          evidence: ev.evidence_notes,
        })),
    }))
    .filter(d => d.items.length > 0)

  // Enrichment equity — group coverage is derived from evidence_entries grp_* fields,
  // not entries grp_* fields. Count provision points that have ≥1 evidence entry
  // targeting each group, expressed as % of total provision points in the sub-domain.
  const enrichBySubDomain = {}
  for (const e of analyticsEntries.filter(e => {
    const domainName = e.provision_points?.sub_domains?.domains?.name || e.domain_name || ''
    return domainName.toLowerCase().includes('enrichment')
  })) {
    const sub = e.provision_points?.sub_domains?.name || e.sub_domain_name || 'Unknown'
    ;(enrichBySubDomain[sub] = enrichBySubDomain[sub] ?? []).push(e)
  }
  const equityData = Object.entries(enrichBySubDomain).map(([subDomain, es]) => ({
    subDomain, total: es.length,
    groups: A_GROUPS.map(g => {
      const count = es.filter(e => (e.evidence_entries ?? []).some(ev => !!ev[g.key])).length
      return {
        label: g.label,
        count,
        pct: es.length ? Math.round((count / es.length) * 100) : 0,
      }
    }),
  }))

  // ── Cross-domain group reach ─────────────────────────────────────
  const reachMatrix = domains.map((d, idx) => {
    const domEvidence = allEvidence.filter(ev =>
      ev.domainId === d.id &&
      (ev.provision_category === 'student_facing' || ev.provision_category === 'whole_school' || Number(ev.reach_total) > 0)
    )
    return {
      domain: d.name,
      shortName: d.name.length > 14 ? d.name.split(/[&\s]/)[0] : d.name,
      colour: aDomainColour(d.name, idx),
      totalReach: domEvidence.reduce((s, ev) => s + (Number(ev.reach_total) || 0), 0),
      groups: REACH_GROUPS.map(g => ({
        label: g.label,
        total: domEvidence.reduce((s, ev) => s + (Number(ev[g.field]) || 0), 0),
      })),
    }
  })

  if (aLoading) return <p className="state-msg">Loading analytics…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* School context panel */}
      <SchoolContextPanel schoolCtx={schoolCtx} onSave={onSave} ctxLoading={ctxLoading} readOnly={readOnly} />

      {/* Inner tab bar + Generate Report button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4, background: '#E2E8F0', borderRadius: 10, padding: 4, flex: 1 }}>
          {ANALYTICS_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: '7px 12px', border: 'none', borderRadius: 7,
                fontSize: '0.8rem',
                fontWeight: activeTab === t.id ? 600 : 400,
                color:      activeTab === t.id ? '#1A202C' : '#64748b',
                background: activeTab === t.id ? '#fff' : 'transparent',
                boxShadow:  activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'readiness'  && <DomainReadiness readinessData={readinessData} upcomingReviews={upcomingReviews} />}
      {activeTab === 'principle'  && <PrincipleCoverage principleData={principleData} />}
      {activeTab === 'equity'     && <ProvisionDepth analyticsEntries={analyticsEntries} domains={domains} onNavigateToCategory={onNavigateToCategory} />}
      {activeTab === 'funding'    && <FundingCost analyticsEntries={analyticsEntries} />}
      {activeTab === 'outcomes'   && <OutcomesImpact allEvidence={allEvidence} domains={domains} analyticsEntries={analyticsEntries} />}
    </div>
  )
}

function ProvisionPointRow({ pp, ppIdx, status, evidenceList, onStatusChange, onOpenModal, readOnly, isFlagged, onFlag, userRole, submittedAt }) {
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)
  const [flagError, setFlagError] = useState(false)

  const stripeColour = status === 'in_place' ? '#257A3B' : status === 'in_progress' ? '#D4751A' : status === 'not_in_place' ? '#EA4335' : '#E2E8F0'

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
        {pp.universal_or_targeted === 'universal' && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: '#DBEAFE', color: '#1E40AF', whiteSpace: 'nowrap', flexShrink: 0,
          }}>Universal</span>
        )}
        {pp.universal_or_targeted === 'targeted' && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: '#EDE9FE', color: '#5B21B6', whiteSpace: 'nowrap', flexShrink: 0,
          }}>Targeted</span>
        )}
        {evidenceList.length > 0 && (
          <span className="evidence-count-badge" title={`${evidenceList.length} evidence ${evidenceList.length === 1 ? 'entry' : 'entries'}`}>
            {evidenceList.length}
          </span>
        )}
        <div className="provision-actions">
          <div className="status-group">
            {STATUSES.map(s => {
              const isGatedInPlace = s === 'in_place' && userRole === 'contributor'
              const isPending = isGatedInPlace && !!submittedAt
              const disabled = readOnly || isPending
              const label = isPending ? 'Awaiting Approval' : isGatedInPlace ? 'Submit for Approval' : STATUS_LABELS[s]
              const title = readOnly
                ? 'You do not have edit access to this school'
                : isPending
                  ? 'Submitted — waiting for an approver to confirm'
                  : undefined
              return (
                <button
                  key={s}
                  type="button"
                  className={`status-btn status-btn--${s.replace(/_/g, '-')}${status === s ? ' active' : ''}`}
                  onClick={disabled ? undefined : () => onStatusChange(pp.id, s)}
                  disabled={disabled}
                  title={title}
                  style={disabled ? { cursor: 'default', opacity: 0.65 } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {!readOnly && (
            <button type="button" className="evidence-btn" onClick={() => onOpenModal(pp)}>
              Add Evidence
            </button>
          )}
          {!readOnly && (
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
  const [allEvidenceCounts, setAllEvidenceCounts] = useState({})
  const [allSubDomains, setAllSubDomains] = useState([])
  const [ppCategoryMap, setPpCategoryMap] = useState({})
  const [ppInfoMap, setPpInfoMap]         = useState({})
  const [overviewMode, setOverviewMode]   = useState('domain')
  const [selectedCategory, setSelectedCategory] = useState(null)

  // School context — lifted from AnalyticsView so home screen and analytics share it
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
  const [analyticsTabRequest, setAnalyticsTabRequest] = useState(null)
  const [expandedSDs, setExpandedSDs] = useState(new Set())
  const [expandedCatDomains, setExpandedCatDomains] = useState(new Set())

  const [flaggedPoints, setFlaggedPoints] = useState(new Set())
  const [utFilter, setUtFilter] = useState('all')  // 'all' | 'universal' | 'targeted'

  // Mobile sidebar
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [demoBannerVisible, setDemoBannerVisible] = useState(sessionStorage.getItem('demoBannerDismissed') !== 'true')

  // MAT / role state
  const [userRole, setUserRole] = useState('contributor')
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
  const [onboardingState, setOnboardingState] = useState(null)
  const [firstLoginPromptVisible, setFirstLoginPromptVisible] = useState(false)
  const [sidebarFlashTeam, setSidebarFlashTeam] = useState(false)
  const [welcomed, setWelcomed] = useState(true)

  // Evidence modal state
  const [modalPoint, setModalPoint] = useState(null)
  const [draft, setDraft] = useState({})
  const [draftId, setDraftId] = useState(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalSaveMsg, setModalSaveMsg] = useState(null)
  const [modalSaveError, setModalSaveError] = useState(false)
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
      setPpInfoMap({})
      setOverviewMode('domain')
      setSelectedCategory(null)
      setUserRole('contributor')
      setViewMode('whole_school')
      setPersonalAssignedPpIds(new Set())
      setTeamMembers([])
      setMissingProfile(false)
      setNeedsPasswordSet(false)
      setOnboardingState(null)
      setFirstLoginPromptVisible(false)
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

    supabase
      .from('profiles')
      .select('school_id, role, mat_id, first_name, schools(name), onboarding_state, welcomed, password_set')
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
        // Invited user who hasn't set a password yet — send to /set-password
        if (data.password_set === false) {
          setNeedsPasswordSet(true)
          setAuthLoading(false)
          return
        }
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
        if (role === 'mat_admin') {
          setView('mat')
        } else {
          setSelectedSchool(data.school_id)
          setSchoolName(data.schools?.name ?? '')
          setView('school')
        }
        setAuthLoading(false)
        initializedUserIdRef.current = session.user.id
      })

    supabase
      .from('domains')
      .select('id, name, display_order, sub_domains(id, name, provision_points(id, label, category))')
      .order('display_order')
      .then(({ data, error }) => {
        if (error) { console.error('Error loading domains:', error); return }
        const newPpDomainMap    = {}
        const newDomainTotals   = {}
        const newSubDomains     = []
        const newPpCategoryMap  = {}
        const newPpInfoMap      = {}
        for (const domain of data ?? []) {
          let count = 0
          for (const sd of domain.sub_domains ?? []) {
            newSubDomains.push({ id: sd.id, name: sd.name, domainId: domain.id, domainName: domain.name })
            for (const pp of sd.provision_points ?? []) {
              newPpDomainMap[pp.id] = domain.id
              newPpCategoryMap[pp.id] = pp.category ?? ''
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
  // the next 30 days ("due soon"), kept distinguishable via isOverdue on each item.
  useEffect(() => {
    if (!selectedSchool) { setOverdueReviews([]); return }
    const todayDate = new Date()
    const today = todayDate.toISOString().slice(0, 10)
    const horizonDate = new Date(todayDate)
    horizonDate.setDate(horizonDate.getDate() + 30)
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
    if (!selectedSchool || !selectedDomain || selectedDomain === 'analytics' || selectedDomain === 'team' || selectedDomain === 'report-builder' || selectedDomain === 'barriers' || selectedDomain === 'inclusion-strategy') {
      setSubDomains([])
      setExpandedSDs(new Set())
      setUtFilter('all')
      return
    }

    setLoading(true)
    setUtFilter('all')

    supabase
      .from('sub_domains')
      .select('id, name, provision_points(id, label, display_order, universal_or_targeted)')
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

  useEffect(() => { setExpandedCatDomains(new Set()) }, [selectedCategory])

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
    setDraft(evidenceEntry ? { ...evidenceEntry } : {})
    setDraftId(evidenceEntry?.id ?? null)
    setModalSaveMsg(null)
    setModalSaveError(false)
  }

  function closeModal() {
    setModalPoint(null)
    setDraft({})
    setDraftId(null)
    setModalSaveMsg(null)
  }

  function handleDraftChange(field, value) {
    setModalSaveMsg(null)
    setDraft(prev => ({ ...prev, [field]: value }))
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

  async function handleStatusChange(ppId, status) {
    if (isDemoMode) return

    // Contributors can't set 'in_place' directly — clicking it submits the point for
    // an approver/mat_admin to confirm instead. Approver/mat_admin keep full direct
    // status-write, including 'in_place', with no approval step.
    if (userRole === 'contributor' && status === 'in_place') {
      return handleSubmitForApproval(ppId)
    }

    const currentEntry = entries[ppId] ?? {}
    setEntries(prev => ({ ...prev, [ppId]: { ...currentEntry, status } }))
    setAllStatuses(prev => ({ ...prev, [ppId]: status }))

    const { data, error } = await supabase
      .from('entries')
      .upsert(
        [{ school_id: selectedSchool, provision_point_id: ppId, ...currentEntry, status }],
        { onConflict: 'school_id,provision_point_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('Error saving status:', error)
    } else if (data?.id && !currentEntry.id) {
      setEntries(prev => ({ ...prev, [ppId]: { ...prev[ppId], id: data.id } }))
    }
  }

  async function handleSubmitForApproval(ppId) {
    const currentEntry = entries[ppId] ?? {}
    const nowIso = new Date().toISOString()
    setEntries(prev => ({ ...prev, [ppId]: { ...currentEntry, submitted_for_approval_at: nowIso } }))

    const { data, error } = await supabase
      .from('entries')
      .upsert(
        [{ school_id: selectedSchool, provision_point_id: ppId, ...currentEntry, submitted_for_approval_at: nowIso }],
        { onConflict: 'school_id,provision_point_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('Error submitting for approval:', error)
      return
    }
    if (data?.id && !currentEntry.id) {
      setEntries(prev => ({ ...prev, [ppId]: { ...prev[ppId], id: data.id } }))
    }

    const { error: logError } = await supabase.from('point_approval_log').insert({
      entry_id: data.id,
      school_id: selectedSchool,
      action: 'submitted',
      actioned_by: session.user.id,
    })
    if (logError) console.error('Error logging submission:', logError)
  }

  async function handleModalSave() {
    if (isDemoMode) return
    if (!selectedSchool || !modalPoint) return
    setModalSaving(true)
    setModalSaveMsg(null)

    // Step 1: ensure entries row exists and get its id
    const currentEntry = entries[modalPoint.id] ?? {}
    const { data: entryRow, error: entryError } = await supabase
      .from('entries')
      .upsert(
        [{ school_id: selectedSchool, provision_point_id: modalPoint.id, ...currentEntry }],
        { onConflict: 'school_id,provision_point_id' }
      )
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

    // Step 2: insert or update evidence_entry
    const evidencePayload = modalPoint.id === EXPERTS_AT_HAND_PP_ID
      ? { ...draft, evidence_type: 'expert_engagement' }
      : draft
    const { data: saved, error: saveError } = draftId
      ? await supabase.from('evidence_entries').update(evidencePayload).eq('id', draftId).select().single()
      : await supabase.from('evidence_entries').insert([{ entry_id: entryRow.id, ...evidencePayload }]).select().single()

    setModalSaving(false)
    setModalSaveError(!!saveError)

    if (saveError) {
      setModalSaveMsg(saveError.message)
    } else {
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
      setModalSaveMsg('Saved.')
    }
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

  // Invite-link landing page — also rendered when password_set flag is false (see profile fetch)
  if (pathname.startsWith('/set-password')) return <SetPasswordPage />

  if (authLoading) {
    return <LoadingScreen />
  }

  if (needsPasswordSet && session) return <SetPasswordPage />

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
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">Inclusion Dashboard</h1>
          {view === 'mat' && <p className="header-sub">MAT Dashboard</p>}
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
              analyticsTabRequest={analyticsTabRequest}
              setAnalyticsTabRequest={setAnalyticsTabRequest}
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
            const catPpIds   = Object.entries(ppCategoryMap).filter(([, c]) => c === selectedCategory).map(([id]) => id)
            const catTotal   = catPpIds.length
            const catInPlace = catPpIds.filter(id => allStatuses[id] === 'in_place').length

            const domainGroupMap = {}
            for (const ppId of catPpIds) {
              const info = ppInfoMap[ppId]
              if (!info) continue
              if (!domainGroupMap[info.domainId]) {
                domainGroupMap[info.domainId] = { domainId: info.domainId, domainName: info.domainName, pps: [] }
              }
              domainGroupMap[info.domainId].pps.push({ id: ppId, label: info.label })
            }
            const domainGroupList = domains.filter(d => domainGroupMap[d.id]).map(d => domainGroupMap[d.id])

            function toggleCatDomain(domainId) {
              setExpandedCatDomains(prev => {
                const next = new Set(prev)
                if (next.has(domainId)) next.delete(domainId)
                else next.add(domainId)
                return next
              })
            }

            return (
              <div>
                <button type="button" onClick={() => setSelectedCategory(null)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '6px 14px',
                  border: '1px solid #CBD5E0', borderRadius: 8, background: 'transparent', color: '#4A5568',
                  fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>← Back</button>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1A202C' }}>{selectedCategory}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{catTotal} point{catTotal !== 1 ? 's' : ''} · {catInPlace} in place</span>
                </div>

                {domainGroupList.map(group => {
                  const isExpanded  = expandedCatDomains.has(group.domainId)
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
                      <button type="button" onClick={() => toggleCatDomain(group.domainId)}
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
                            onStatusChange={handleStatusChange}
                            onOpenModal={openModal}
                            readOnly={readOnly}
                            isFlagged={flaggedPoints.has(pp.id)}
                            onFlag={handleFlag}
                            userRole={userRole}
                            submittedAt={entries[pp.id]?.submitted_for_approval_at}
                          />
                        ))}
                        {needsTrunc && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, rgba(255,255,255,0), #fff)', pointerEvents: 'none' }} />
                        )}
                      </div>

                      <ShowToggle expanded={isExpanded} total={ppCount} onToggle={() => toggleCatDomain(group.domainId)} />
                    </div>
                  )
                })}
              </div>
            )
          }

          // ── Home screen ───────────────────────────────────────────────
          const allPpIds   = Object.keys(ppDomainMap)
          const totTotal   = allPpIds.length
          const totInPlace = allPpIds.filter(id => allStatuses[id] === 'in_place').length
          const readPct    = totTotal ? Math.round((totInPlace / totTotal) * 100) : 0

          const hour     = new Date().getHours()
          const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

          const untouchedCount = allPpIds.filter(id => !(allEvidenceCounts[id] > 0)).length

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

          // Domain cards with RAG triage — scoped to assigned points in personal view
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

              {/* Greeting row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#1A202C', lineHeight: 1.25 }}>
                    {greeting}{firstName ? `, ${firstName}` : ''}.
                  </h1>
                  {schoolName && (
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 3 }}>{schoolName}</p>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedDomain('report-builder')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#475569',
                  fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <i className="ti ti-file-export" style={{ fontSize: '0.9rem', color: '#94a3b8' }} />
                  Generate report
                </button>
              </div>

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

              {/* Contributor welcome banner — shown once after first assignment */}
              {userRole === 'contributor' && !welcomed && personalAssignedPpIds.size > 0 && (
                <div style={{
                  background: 'rgba(27,54,93,0.05)', border: '1px solid rgba(27,54,93,0.18)',
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1B365D', marginBottom: 4 }}>
                      Welcome{firstName ? `, ${firstName}` : ''}. You have {personalAssignedPpIds.size} provision point{personalAssignedPpIds.size !== 1 ? 's' : ''} to look after.
                    </p>
                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
                      Explore them below, add evidence, and track your progress.
                    </p>
                  </div>
                  <button type="button"
                    onClick={async () => {
                      setWelcomed(true)
                      await supabase.from('profiles').update({ welcomed: true }).eq('id', session.user.id)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0,
                    }}>✕</button>
                </div>
              )}

              {/* Empty personal view state */}
              {isPersonalView && totalAssigned === 0 ? (
                <div style={{
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                  padding: '32px 24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1A202C', marginBottom: 6 }}>
                    {viewingAsMember
                      ? `No points have been assigned to ${viewingAsMember.first_name} yet.`
                      : 'Your points haven\'t been assigned yet.'}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    {viewingAsMember
                      ? 'Use the Team screen to assign provision points to this person.'
                      : 'Your headteacher will set these up shortly.'}
                  </p>
                </div>
              ) : (
                <>
              {/* Readiness + Reviews band */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>

                {/* Left: readiness — always whole-school */}
                <div style={{
                  flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 10 }}>
                    <span style={{ fontSize: '2.8rem', fontWeight: 700, color: '#1B365D', lineHeight: 1 }}>{readPct}%</span>
                    <div style={{ paddingBottom: 4 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>Overall readiness</p>
                      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{totInPlace} of {totTotal} indicators in place</p>
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${readPct}%`, background: '#1B365D', borderRadius: 99, transition: 'width 0.4s' }} />
                  </div>
                  {untouchedCount > 0 && (
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 10 }}>
                      {untouchedCount} provision point{untouchedCount !== 1 ? 's' : ''} haven't been started yet.
                    </p>
                  )}
                  {(userRole === 'approver' || userRole === 'mat_admin') && approvalQueueCount > 0 && (
                    <button type="button" onClick={() => setApprovalQueueOpen(true)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                      marginTop: 10, padding: '5px 12px', borderRadius: 999, border: '1px solid #FBBF24',
                      background: '#FEF3C7', color: '#92400E', fontSize: '0.78rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <i className="ti ti-clipboard-check" style={{ fontSize: '0.9rem' }} />
                      {approvalQueueCount} awaiting approval
                    </button>
                  )}
                </div>

                {/* Right: reviews due — filtered in personal view, hidden if none */}
                {reviewsDueCount > 0 && (
                  <div style={{
                    width: 340, flexShrink: 0,
                    background: '#F0FDFA', border: '1px solid #99f6e4', borderRadius: 12, padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>
                      Evaluate &amp; Sustain — due this term
                    </p>
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

              {/* Domain cards — 3×2 grid, RAG-sorted */}
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
              </>
              )}

            </div>
          )
        })()}

        {view !== 'mat' && selectedSchool && selectedDomain === 'analytics' && (
          <AnalyticsView school={selectedSchool} supabase={supabase} schoolName={schoolName} tabRequest={analyticsTabRequest} schoolCtx={schoolCtx} onSave={handleCtxSave} ctxLoading={ctxLoading} readOnly={readOnly}
            onNavigateToCategory={cat => { setSelectedDomain(''); setAnalyticsTabRequest(null); setOverviewMode('category'); setSelectedCategory(cat) }}
          />
        )}

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
            supabase={supabase}
            onInviteUser={openInviteModal}
            readOnly={readOnly}
            userRole={userRole}
          />
        )}

        {firstLoginPromptVisible && session && selectedSchool && userRole === 'approver' && (
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

        {view !== 'mat' && selectedSchool && selectedDomain && selectedDomain !== 'analytics' && selectedDomain !== 'report-builder' && selectedDomain !== 'team' && selectedDomain !== 'barriers' && selectedDomain !== 'inclusion-strategy' && (
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
            function toggleSD(sdId) {
              setExpandedSDs(prev => {
                if (prev.has(sdId)) return new Set()
                return new Set([sdId])
              })
            }
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

                {/* Sub-domain collapsible sections */}
                {subDomains.map(sd => {
                  const isExpanded = expandedSDs.has(sd.id)
                  const pps = utFilter === 'all'
                    ? sd.provision_points
                    : sd.provision_points.filter(p => p.universal_or_targeted === utFilter)
                  const ppCount = pps.length
                  if (ppCount === 0) return null
                  const sdInPlace   = pps.filter(p => entries[p.id]?.status === 'in_place').length
                  const sdInProg    = pps.filter(p => entries[p.id]?.status === 'in_progress').length
                  const sdUntouched = pps.filter(p => !entries[p.id]?.status).length
                  const needsTrunc  = ppCount > 3 && !isExpanded
                  const visiblePPs  = needsTrunc ? pps.slice(0, 3) : pps

                  return (
                    <div key={sd.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                      {/* Section header — click anywhere to toggle */}
                      <button type="button" onClick={() => toggleSD(sd.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: '0.5px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left',
                        }}>
                        <i className="ti ti-chevron-down"
                           style={{ fontSize: '0.8rem', color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
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
                      </button>

                      {/* Provision point rows */}
                      <div style={{ position: 'relative' }}>
                        {visiblePPs.map((pp, ppIdx) => (
                          <ProvisionPointRow
                            key={pp.id}
                            pp={pp}
                            ppIdx={ppIdx}
                            status={entries[pp.id]?.status}
                            evidenceList={evidenceEntries[pp.id] ?? []}
                            onStatusChange={handleStatusChange}
                            onOpenModal={openModal}
                            readOnly={readOnly}
                            isFlagged={flaggedPoints.has(pp.id)}
                            onFlag={handleFlag}
                            userRole={userRole}
                            submittedAt={entries[pp.id]?.submitted_for_approval_at}
                          />
                        ))}

                        {/* Fade mask when truncated */}
                        {needsTrunc && (
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0), #fff)',
                            pointerEvents: 'none',
                          }} />
                        )}
                      </div>

                      <ShowToggle expanded={isExpanded} total={ppCount} onToggle={() => toggleSD(sd.id)} />
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
              <div className="detail-grid">
                {(() => {
                  const cat = draft.provision_category ?? ''
                  const isStudentFacing  = cat === 'student_facing'
                  const isPolicyStruct   = cat === 'policy_structural'
                  const isWholeSchool    = cat === 'whole_school'
                  const isLegacy         = cat === ''
                  const showReach        = isStudentFacing || isWholeSchool
                  const showCost         = isStudentFacing || isWholeSchool || isLegacy
                  const showOutcomes     = isStudentFacing || isWholeSchool || isLegacy
                  const showDates        = isStudentFacing || isWholeSchool || isLegacy || isPolicyStruct

                  const reachInputStyle = { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem', width: '100%' }

                  return (
                    <>
                      {/* ── Always: name + provision type ── */}
                      <div className="df df--half">
                        <label>Provision Name</label>
                        <input type="text" value={draft.provision_name ?? ''} onChange={e => handleDraftChange('provision_name', e.target.value)} />
                      </div>

                      <div className="df df--half">
                        <label>Provision Type</label>
                        <select value={cat} onChange={e => handleDraftChange('provision_category', e.target.value)}>
                          <option value="">— Select type —</option>
                          {PROVISION_CATEGORIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* ── Policy/Structural or Legacy: named role doc ── */}
                      {(isPolicyStruct || isLegacy) && (
                        <div className="df df--half">
                          <label>Named Role / Policy / Document</label>
                          <input type="text" value={draft.named_role_policy_document ?? ''} onChange={e => handleDraftChange('named_role_policy_document', e.target.value)} />
                        </div>
                      )}

                      {/* ── All except policy: brief description ── */}
                      {!isPolicyStruct && (
                        <div className={`df ${isPolicyStruct ? 'df--half' : 'df--full'}`}>
                          <label>Brief Description</label>
                          <textarea rows={2} value={draft.brief_description ?? ''} onChange={e => handleDraftChange('brief_description', e.target.value)} />
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
                                  <input type="checkbox" checked={checked} onChange={() => {
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
                        <input type="text" value={draft.delivered_by ?? ''} onChange={e => handleDraftChange('delivered_by', e.target.value)} />
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
                              <select value={detail.professional_type ?? ''} onChange={e => handleDetailChange('professional_type', e.target.value)}>
                                <option value="">— Select type —</option>
                                {EXPERT_PROFESSIONAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div className="df df--half">
                              <label>Commissioning Route</label>
                              <select value={detail.commissioning_route ?? ''} onChange={e => handleDetailChange('commissioning_route', e.target.value)}>
                                <option value="">— Select route —</option>
                                {EXPERT_COMMISSIONING_ROUTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            </div>
                            <div className="df df--half">
                              <label>Activity Type</label>
                              <select value={detail.activity_type ?? ''} onChange={e => handleDetailChange('activity_type', e.target.value)}>
                                <option value="">— Select activity —</option>
                                {EXPERT_ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                              </select>
                            </div>
                            <div className="df df--quarter">
                              <label>Pupils Reached</label>
                              <input type="number" min="0" step="1"
                                value={detail.pupils_reached ?? ''}
                                onChange={e => handleDetailChange('pupils_reached', e.target.value === '' ? null : Number(e.target.value))} />
                            </div>
                            <div className="df df--quarter" style={{ justifyContent: 'flex-end' }}>
                              <label className="tier-checkbox-label" style={{ marginTop: 'auto', marginBottom: 6 }}>
                                <input type="checkbox" checked={detail.report_received ?? false}
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
                              <input type="number" min="0" step="1" style={reachInputStyle}
                                value={draft.reach_total ?? ''}
                                onChange={e => handleDraftChange('reach_total', e.target.value === '' ? null : Number(e.target.value))} />
                            </div>
                            {REACH_GROUPS.map(g => (
                              <div key={g.field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{g.label}</label>
                                <input type="number" min="0" step="1" style={reachInputStyle}
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
                                  <input type="checkbox" checked={draft[g.value] ?? false} onChange={e => handleDraftChange(g.value, e.target.checked)} />
                                  {g.label}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="df df--quarter">
                            <label>Pupils / People Reached</label>
                            <input type="number" min="0" step="1"
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
                            <input type="number" min="0" step="1"
                              value={draft.cost ?? ''}
                              onChange={e => handleDraftChange('cost', e.target.value === '' ? null : Number(e.target.value))} />
                          </div>
                          <div className="df df--half">
                            <label>Funding Source</label>
                            <select value={draft.funding_source ?? ''} onChange={e => handleDraftChange('funding_source', e.target.value)}>
                              <option value="">—</option>
                              {FUNDING_SOURCES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                        </>
                      )}

                      {/* ── Date fields ── */}
                      {showDates && (
                        <>
                          <div className="df df--half">
                            <label>Date Provision Started</label>
                            <input type="date" value={draft.date_started ?? ''} onChange={e => handleDraftChange('date_started', e.target.value || null)} />
                          </div>
                          <div className="df df--half">
                            <label>Date Last Evaluated &amp; Sustained</label>
                            <input type="date" value={draft.date_last_reviewed ?? ''} onChange={e => handleDraftChange('date_last_reviewed', e.target.value || null)} />
                          </div>
                          <div className="df df--half">
                            <label>Next Evaluate &amp; Sustain Date</label>
                            <input type="date" value={draft.next_review_due ?? ''} onChange={e => handleDraftChange('next_review_due', e.target.value || null)} />
                          </div>
                          <div className="df df--half">
                            <label>Evaluate &amp; Sustain Cycle</label>
                            <select value={draft.review_cycle ?? ''} onChange={e => handleDraftChange('review_cycle', e.target.value)}>
                              <option value="">—</option>
                              {REVIEW_CYCLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <small style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: 4, lineHeight: 1.5 }}>
                              Regular evaluation cycles are the foundation of the EEF's Sustain phase — keeping provision active and improving.
                            </small>
                          </div>
                        </>
                      )}

                      {/* ── Intended outcomes ── */}
                      {showOutcomes && (
                        <div className="df df--full">
                          <label>Intended Outcomes</label>
                          {isStudentFacing && <span className="field-hint">What barriers are you aiming to remove for this group?</span>}
                          <textarea rows={3} value={draft.intended_outcomes ?? ''} onChange={e => handleDraftChange('intended_outcomes', e.target.value)} />
                        </div>
                      )}

                      {/* ── Impact on outcomes (student-facing + legacy) ── */}
                      {(isStudentFacing || isLegacy) && (
                        <div className="df df--full">
                          <label>Impact on Outcomes</label>
                          <textarea rows={3} value={draft.impact_on_outcomes ?? ''} onChange={e => handleDraftChange('impact_on_outcomes', e.target.value)} />
                        </div>
                      )}

                      {/* ── Evidence / implementation evidence ── */}
                      {(isStudentFacing || isWholeSchool || isLegacy) && (
                        <div className="df df--full">
                          <label>{isWholeSchool ? 'Implementation Evidence' : 'Evidence of Impact'}</label>
                          <textarea rows={3} value={draft.evidence_notes ?? ''} onChange={e => handleDraftChange('evidence_notes', e.target.value)} />
                        </div>
                      )}

                      {/* ── Always: document link + notes ── */}
                      <div className="df df--full">
                        <label>Supporting Document Link</label>
                        <input type="url" placeholder="https://…" value={draft.supporting_document_link ?? ''} onChange={e => handleDraftChange('supporting_document_link', e.target.value)} />
                      </div>

                      <div className="df df--full">
                        <label>Notes</label>
                        <textarea rows={2} value={draft.notes ?? ''} onChange={e => handleDraftChange('notes', e.target.value)} />
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="modal-footer">
              {draftId && !readOnly && (
                <button type="button" className="delete-btn" onClick={handleModalDelete} disabled={modalSaving}>
                  Delete
                </button>
              )}
              <div className="modal-footer-right">
                {readOnly && (
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>Read only — viewing {browsingSchoolName}</span>
                )}
                {!readOnly && modalSaveMsg && (
                  <span className={`save-msg${modalSaveError ? ' save-msg--error' : ' save-msg--ok'}`}>
                    {modalSaveMsg}
                  </span>
                )}
                <button type="button" className="modal-cancel-btn" onClick={closeModal}>Close</button>
                {!readOnly && (
                  <button type="button" className="save-btn" onClick={handleModalSave} disabled={modalSaving}>
                    {modalSaving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>

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
