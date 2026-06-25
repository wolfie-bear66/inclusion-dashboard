import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import MATDashboard from './MATDashboard'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import TeamPage from './pages/TeamPage'
import OnboardingPrompt from './components/OnboardingPrompt'
import './App.css'
import { generateReport } from './generateReport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

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
  { field: 'reach_other', label: 'Other' },
]
const EV_GROUPS = [
  { value: 'grp_send', label: 'SEND' },
  { value: 'grp_pp',   label: 'PP' },
  { value: 'grp_eal',  label: 'EAL' },
  { value: 'grp_fsm',  label: 'FSM' },
  { value: 'grp_lac',  label: 'LAC' },
  { value: 'grp_wwc',  label: 'White Working Class' },
  { value: 'grp_other', label: 'Other' },
]

// entries holds status + group flags; evidence detail lives in evidence_entries (nested)
const ENTRY_SELECT = [
  'id', 'provision_point_id', 'status',
  'grp_send', 'grp_pp', 'grp_eal', 'grp_fsm', 'grp_lac', 'grp_wwc', 'grp_other',
  'evidence_entries(id, provision_name, brief_description, indicator_type, provision_category, named_role_policy_document, delivered_by, send_tiers, pupils_reached, reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc, reach_other, grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other, date_started, date_last_reviewed, next_review_due, funding_source, cost, review_cycle, evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link, notes)',
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
]

const FUNDING_LABELS_MAP = {
  pupil_premium:             'Pupil Premium',
  send_budget:               'SEND Budget',
  inclusive_mainstream_fund: 'IMF',
  sport_premium:             'Sport Premium',
  school_general_budget:     'General Budget',
}

const ANALYTICS_TABS = [
  { id: 'readiness', label: 'Domain Readiness' },
  { id: 'equity',    label: 'Provision Depth' },
  { id: 'funding',   label: 'Funding & Cost' },
  { id: 'outcomes',  label: 'Outcomes & Impact' },
]

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
        {(userRole === 'approver' || userRole === 'mat_admin') && (
          <button
            type="button"
            onClick={onInviteUser}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', marginTop: 8, padding: '6px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <i className="ti ti-user-plus" style={{ fontSize: '0.82rem', color: '#94a3b8' }} />
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Invite user</span>
          </button>
        )}
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

function ReportBuilder({ schoolName = '', allSubDomains = [], supabase: sb, school, schoolCtx = {} }) {
  const [includeEquity,   setIncludeEquity]   = useState(true)
  const [equityChart,     setEquityChart]     = useState('table')
  const [includeFunding,  setIncludeFunding]  = useState(true)
  const [fundingChart,    setFundingChart]    = useState('bar')
  const [includeOutcomes, setIncludeOutcomes] = useState(true)
  const [outcomeMode,     setOutcomeMode]     = useState('all')
  const [outcomeSelected, setOutcomeSelected] = useState([])
  const [includeReach,    setIncludeReach]    = useState(false)
  const [reachChart,      setReachChart]      = useState('table')
  const [generating,      setGenerating]      = useState(false)
  const [genError,        setGenError]        = useState(null)

  const domainPills    = ['SEND Support & Needs', 'Equity & Disadvantage', 'Attendance & Engagement', 'Enrichment', 'Belonging', 'Wellbeing']
  const groupPills     = ['Pupil Premium', 'SEND', 'FSM', 'EAL', 'LAC', 'White Working Class']
  const subDomainPills = [...new Set(allSubDomains.map(sd => sd.name))].sort()

  function changeMode(mode) { setOutcomeMode(mode); setOutcomeSelected([]) }
  function togglePill(val)  { setOutcomeSelected(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]) }

  const pillOptions = outcomeMode === 'domain' ? domainPills : outcomeMode === 'group' ? groupPills : outcomeMode === 'subdomain' ? subDomainPills : []

  const outcomesPreview = (() => {
    if (outcomeMode === 'all') return 'Report will include all outcomes across all domains'
    const noun = outcomeMode === 'domain' ? 'domains' : outcomeMode === 'group' ? 'student groups' : 'sub-domains'
    if (outcomeSelected.length === 0) return `Select one or more ${noun}`
    return `Report will include outcomes for ${outcomeSelected.join(', ')}`
  })()

  const outcomeSuffix = outcomeMode !== 'all' && outcomeSelected.length > 0 ? ` (${outcomeSelected.join(', ')})` : ''
  const includedSections = [
    'domain readiness',
    ...(includeEquity   ? ['enrichment equity']               : []),
    ...(includeFunding  ? ['funding & cost']                   : []),
    ...(includeOutcomes ? [`outcomes & impact${outcomeSuffix}`]: []),
    ...(includeReach    ? ['group reach']                      : []),
  ]

  async function handleGeneratePdf() {
    if (!sb || !school) {
      setGenError('School data not available. Please reload and try again.')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const [entriesRes, domainsRes] = await Promise.all([
        sb.from('entries')
          .select(`
            id, provision_point_id, status,
            grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
            provision_points(*, sub_domains(*, domains(id, name))),
            evidence_entries(id, provision_name, indicator_type, provision_category, funding_source, cost, next_review_due,
              evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link,
              reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc, reach_other,
              grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other)
          `)
          .eq('school_id', school),
        sb.from('domains').select('id, name, display_order').order('display_order'),
      ])

      if (entriesRes.error) throw new Error(`Entries fetch failed: ${entriesRes.error.message}`)
      if (domainsRes.error) throw new Error(`Domains fetch failed: ${domainsRes.error.message}`)

      const analyticsEntries = entriesRes.data ?? []
      const fetchedDomains   = domainsRes.data ?? []

      console.log('[ReportBuilder] fetched entries:', analyticsEntries.length, '| domains:', fetchedDomains.length)

      // Domain readiness
      const readinessData = fetchedDomains.map((d, idx) => {
        const de = analyticsEntries.filter(e => e.provision_points?.sub_domains?.domains?.id === d.id)
        return {
          name:       d.name.length > 14 ? d.name.split(/[&\s]/)[0] : d.name,
          fullName:   d.name,
          colour:     aDomainColour(d.name, idx),
          inPlace:    de.filter(e => e.status === 'in_place').length,
          inProgress: de.filter(e => e.status === 'in_progress').length,
          notInPlace: de.filter(e => e.status === 'not_in_place').length,
          total:      de.length,
        }
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

      // Upcoming reviews (next 60 days)
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

      // Enrichment equity
      const enrichBySubDomain = {}
      for (const e of analyticsEntries.filter(e => {
        const dn = e.provision_points?.sub_domains?.domains?.name ?? ''
        return dn.toLowerCase().includes('enrichment')
      })) {
        const sub = e.provision_points?.sub_domains?.name ?? 'Unknown'
        ;(enrichBySubDomain[sub] = enrichBySubDomain[sub] ?? []).push(e)
      }
      const equityData = Object.entries(enrichBySubDomain).map(([subDomain, es]) => ({
        subDomain, total: es.length,
        groups: A_GROUPS.map(g => {
          const count = es.filter(e => (e.evidence_entries ?? []).some(ev => !!ev[g.key])).length
          return { label: g.label, count, pct: es.length ? Math.round((count / es.length) * 100) : 0 }
        }),
      }))

      generateReport({
        schoolCtx,
        readinessData,
        upcomingReviews,
        equityData,
        fundingSourceData,
        fundingDomainData,
        totalCost,
        allEvidence,
        domains: fetchedDomains,
        schoolName,
        options: { includeEquity, equityChart, includeFunding, fundingChart, includeOutcomes, outcomeMode, outcomeSelected, includeReach, reachChart },
      })
    } catch (err) {
      console.error('[ReportBuilder] generation error:', err)
      setGenError('Could not generate report — check console for details.')
    }
    setGenerating(false)
  }

  const card = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 10 }
  const row  = { display: 'flex', alignItems: 'center', gap: 12 }
  const body = { marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <h1 style={{ fontSize: 15, fontWeight: 500, color: '#1A202C', marginBottom: 4 }}>Report builder</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>Choose what to include and how to present it. School context and domain readiness are always included.</p>
      </div>

      {/* Section cards */}
      <div style={{ flex: 1, paddingBottom: 72 }}>

        {/* 1. Domain Readiness */}
        <div style={card}>
          <div style={row}>
            <RBIconBox bg="rgba(27,54,93,0.10)" color="#1B365D" icon="ti-circle-check" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>Domain Readiness</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Overall % readiness, by-domain breakdown, upcoming reviews</p>
            </div>
            <RBBadge text="Always included" />
          </div>
        </div>

        {/* 2. Enrichment Equity */}
        <div style={card}>
          <div style={row}>
            <RBIconBox bg="rgba(27,54,93,0.10)" color="#1B365D" icon="ti-scale" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>Enrichment Equity</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Group coverage across enrichment sub-domains</p>
            </div>
            <RBBadge text={includeEquity ? 'Included' : 'Not included'} included={includeEquity} />
            <RBToggle value={includeEquity} onChange={setIncludeEquity} />
          </div>
          {includeEquity && (
            <div style={body}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Chart style</p>
              <RBChartToggle options={[{value:'table',label:'Table'},{value:'radar',label:'Radar'}]} value={equityChart} onChange={setEquityChart} />
            </div>
          )}
        </div>

        {/* 3. Funding & Cost */}
        <div style={card}>
          <div style={row}>
            <RBIconBox bg="#E6F1FB" color="#185FA5" icon="ti-currency-pound" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>Funding & Cost</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Total spend, per-pupil costs, by domain and funding stream</p>
            </div>
            <RBBadge text={includeFunding ? 'Included' : 'Not included'} included={includeFunding} />
            <RBToggle value={includeFunding} onChange={setIncludeFunding} />
          </div>
          {includeFunding && (
            <div style={body}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Chart style</p>
              <RBChartToggle options={[{value:'bar',label:'Bar chart'},{value:'table',label:'Table'}]} value={fundingChart} onChange={setFundingChart} />
            </div>
          )}
        </div>

        {/* 4. Outcomes & Impact */}
        <div style={card}>
          <div style={row}>
            <RBIconBox bg="#FAEEDA" color="#854F0B" icon="ti-target" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>Outcomes & Impact</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Intended outcomes and evidence of impact</p>
            </div>
            <RBBadge text={includeOutcomes ? 'Included' : 'Not included'} included={includeOutcomes} />
            <RBToggle value={includeOutcomes} onChange={setIncludeOutcomes} />
          </div>
          {includeOutcomes && (
            <div style={body}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Filter by</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['all','All'],['domain','Domain'],['group','Student group'],['subdomain','Sub-domain']].map(([mode, label]) => {
                    const active = outcomeMode === mode
                    return (
                      <button key={mode} type="button" onClick={() => changeMode(mode)} style={{
                        padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1.5px solid ${active ? '#1B365D' : '#e2e8f0'}`,
                        background: active ? 'rgba(27,54,93,0.10)' : '#fff',
                        color:      active ? '#1B365D' : '#64748b',
                        fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                      }}>{label}</button>
                    )
                  })}
                </div>
              </div>

              {outcomeMode !== 'all' && pillOptions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {pillOptions.map(opt => {
                      const sel = outcomeSelected.includes(opt)
                      return (
                        <button key={opt} type="button" onClick={() => togglePill(opt)} style={{
                          padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1.5px solid ${sel ? '#1B365D' : '#e2e8f0'}`,
                          background: sel ? 'rgba(27,54,93,0.10)' : '#fff',
                          color:      sel ? '#1B365D' : '#475569',
                          fontSize: '0.75rem', fontWeight: sel ? 600 : 400,
                        }}>{opt}</button>
                      )
                    })}
                  </div>
                  <button type="button" onClick={() => setOutcomeSelected([])} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.75rem', color: '#1B365D', padding: 0, fontFamily: 'inherit',
                  }}>Clear selection</button>
                </div>
              )}

              <div style={{ background: '#F0F2F5', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <i className="ti ti-info-circle" style={{ color: '#1B365D', fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{outcomesPreview}</p>
              </div>
            </div>
          )}
        </div>

        {/* 5. Group Reach */}
        <div style={card}>
          <div style={row}>
            <RBIconBox bg="#FBEAF0" color="#993556" icon="ti-users" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>Group Reach</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Student numbers reached per group across all domains</p>
            </div>
            <RBBadge text={includeReach ? 'Included' : 'Not included'} included={includeReach} />
            <RBToggle value={includeReach} onChange={setIncludeReach} />
          </div>
          {includeReach && (
            <div style={body}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Chart style</p>
              <RBChartToggle options={[{value:'table',label:'Table'},{value:'bar',label:'Bar chart'}]} value={reachChart} onChange={setReachChart} />
            </div>
          )}
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
          <p style={{ fontSize: '0.8rem', color: '#64748b', flex: 1, minWidth: 0 }}>
            Includes {includedSections.length} section{includedSections.length !== 1 ? 's' : ''} — {includedSections.join(', ')}
          </p>
          <button type="button" onClick={handleGeneratePdf} disabled={generating} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: generating ? '#94a3b8' : '#1B365D', color: '#fff',
            fontSize: '0.85rem', fontWeight: 600, cursor: generating ? 'default' : 'pointer', flexShrink: 0, fontFamily: 'inherit',
          }}>
            <i className="ti ti-download" style={{ fontSize: '0.9rem', lineHeight: 1 }} />
            {generating ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
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
          <ASectionTitle sub="Evidence entries with a review due within the next 60 days">Compliance Forecast</ASectionTitle>
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

function FundingCost({ fundingDomainData, fundingSourceData, totalCost, schoolCtx }) {
  const [showFundingInputs, setShowFundingInputs] = useState(false)
  const [fundingReceived, setFundingReceived] = useState({})

  const equitySpend = fundingDomainData.find(d => d.fullName?.includes('Equity'))?.value ?? 0
  const sendSpend   = fundingDomainData.find(d => d.fullName?.includes('SEND'))?.value ?? 0
  const perPupil    = schoolCtx.totalPupils ? Math.round(totalCost / schoolCtx.totalPupils) : null
  const perPP       = schoolCtx.ppCount     ? Math.round(equitySpend / schoolCtx.ppCount)   : null
  const perSEND     = schoolCtx.sendCount   ? Math.round(sendSpend   / schoolCtx.sendCount) : null

  if (totalCost === 0) return (
    <ACard>
      <ASectionTitle sub="Annual cost of provision grouped by funding source and domain">Funding & Cost</ASectionTitle>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No cost data recorded yet.</p>
    </ACard>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total spend',    value: `£${totalCost.toLocaleString()}` },
          { label: 'Per pupil',      value: perPupil  ? `£${perPupil.toLocaleString()}`  : '—' },
          { label: 'Per PP pupil',   value: perPP     ? `£${perPP.toLocaleString()}`     : '—' },
          { label: 'Per SEND pupil', value: perSEND   ? `£${perSEND.toLocaleString()}`   : '—' },
        ].map((s, i) => (
          <ACard key={i}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A202C' }}>{s.value}</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{s.label}</p>
          </ACard>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ACard>
          <ASectionTitle sub="Annual spend by domain">By Domain</ASectionTitle>
          {fundingDomainData.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No domain cost data.</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fundingDomainData} layout="vertical" barCategoryGap="30%" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `£${v.toLocaleString()}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} />
                  <Tooltip formatter={v => `£${Number(v).toLocaleString()}`} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {fundingDomainData.map((d, idx) => <Cell key={idx} fill={d.colour} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ACard>

        <ACard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C' }}>Funding Streams</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Spend proportion by source</p>
            </div>
            <button type="button" onClick={() => setShowFundingInputs(v => !v)}
              style={{ fontSize: '0.75rem', color: '#1B365D', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {showFundingInputs ? 'Hide' : 'Add funding received'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fundingSourceData.map((fs, i) => {
              const pct      = totalCost ? Math.round((fs.value / totalCost) * 100) : 0
              const received = Number(fundingReceived[fs.name] ?? 0)
              const diff     = received - fs.value
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569' }}>{fs.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {received > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
                          {diff >= 0 ? `+£${diff.toLocaleString()}` : `-£${Math.abs(diff).toLocaleString()}`}
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1A202C' }}>£{fs.value.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#1B365D', transition: 'width 0.4s' }} />
                  </div>
                  {showFundingInputs && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Received £</label>
                      <input type="number" min="0"
                        style={{ flex: 1, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.8rem' }}
                        value={fundingReceived[fs.name] ?? ''}
                        onChange={e => setFundingReceived(prev => ({ ...prev, [fs.name]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ACard>
      </div>
    </div>
  )
}

function OutcomesImpact({ allEvidence, domains, analyticsEntries }) {
  const [filterMode, setFilterMode] = useState('all')
  const [activeFilters, setActiveFilters] = useState([])

  const allItems = allEvidence
    .filter(ev => ev.intended_outcomes || ev.impact_on_outcomes || ev.evidence_notes)
    .map(ev => {
      const dIdx = domains.findIndex(d => d.id === ev.domainId)
      return {
        name:      ev.provision_name || ev.entryLabel,
        point:     ev.entryLabel,
        domain:    ev.domainName,
        subDomain: ev.subDomainName,
        colour:    dIdx >= 0 ? aDomainColour(ev.domainName, dIdx) : '#94a3b8',
        groups:    A_GROUPS.filter(g => ev[g.key]).map(g => g.label),
        intended:  ev.intended_outcomes,
        impact:    ev.impact_on_outcomes,
        docLink:   ev.supporting_document_link || null,
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

  const filteredItems = filterMode === 'all' || nonUnassignedFilters.length === 0
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
      {/* Filter controls */}
      <div>
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
            <div style={{ marginBottom: item.docLink ? 10 : 0 }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Evidence of impact</p>
              <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>{item.impact}</p>
            </div>
          )}
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

function SchoolContextPanel({ schoolCtx, onSave, ctxLoading }) {
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
            ].map((f, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1A202C' }}>{ctxLoading ? '…' : (f.value || '—')}</p>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
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
      </div>
      {editingCtx && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 16px' }}>
          {[
            { key: 'totalPupils', label: 'Total pupils' },
            { key: 'ppCount',    label: 'Pupil Premium' },
            { key: 'sendCount',  label: 'SEND' },
            { key: 'fsmCount',   label: 'FSM' },
            { key: 'ealCount',   label: 'EAL' },
            { key: 'lacCount',   label: 'LAC' },
            { key: 'wwcCount',   label: 'WW Class' },
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

function AnalyticsView({ school, supabase: sb, schoolName = '', tabRequest = null, schoolCtx, onSave, ctxLoading, onNavigateToCategory }) {
  const [analyticsEntries, setAnalyticsEntries] = useState([])
  const [domains, setDomains] = useState([])
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
            reach_total, reach_send, reach_pp, reach_eal, reach_fsm, reach_lac, reach_wwc, reach_other,
            grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other)
        `)
        .eq('school_id', school),
      sb.from('domains').select('id, name, display_order').order('display_order'),
    ]).then(([entriesRes, domainsRes]) => {
      if (entriesRes.error) console.error('Analytics entries error:', entriesRes.error)
      if (domainsRes.error) console.error('Analytics domains error:', domainsRes.error)
      setAnalyticsEntries(entriesRes.data ?? [])
      setDomains(domainsRes.data ?? [])
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
      <SchoolContextPanel schoolCtx={schoolCtx} onSave={onSave} ctxLoading={ctxLoading} />

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

      {activeTab === 'readiness' && <DomainReadiness readinessData={readinessData} upcomingReviews={upcomingReviews} />}
      {activeTab === 'equity'    && <ProvisionDepth analyticsEntries={analyticsEntries} domains={domains} onNavigateToCategory={onNavigateToCategory} />}
      {activeTab === 'funding'   && <FundingCost fundingDomainData={fundingDomainData} fundingSourceData={fundingSourceData} totalCost={totalCost} schoolCtx={schoolCtx} />}
      {activeTab === 'outcomes'  && <OutcomesImpact allEvidence={allEvidence} domains={domains} analyticsEntries={analyticsEntries} />}
    </div>
  )
}

function ProvisionPointRow({ pp, ppIdx, status, evidenceList, onStatusChange, onOpenModal, readOnly, isFlagged, onFlag }) {
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
        {evidenceList.length > 0 && (
          <span className="evidence-count-badge" title={`${evidenceList.length} evidence ${evidenceList.length === 1 ? 'entry' : 'entries'}`}>
            {evidenceList.length}
          </span>
        )}
        <div className="provision-actions">
          <div className="status-group">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                className={`status-btn status-btn--${s.replace(/_/g, '-')}${status === s ? ' active' : ''}`}
                onClick={readOnly ? undefined : () => onStatusChange(pp.id, s)}
                disabled={readOnly}
                title={readOnly ? 'You do not have edit access to this school' : undefined}
                style={readOnly ? { cursor: 'default', opacity: 0.65 } : undefined}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {!readOnly && (
            <button type="button" className="evidence-btn" onClick={() => onOpenModal(pp)}>
              Add Evidence
            </button>
          )}
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
  const [schoolCtx, setSchoolCtx] = useState({ totalPupils: 0, ppCount: 0, sendCount: 0, fsmCount: 0, ealCount: 0, lacCount: 0, wwcCount: 0 })
  const [ctxLoading, setCtxLoading] = useState(true)

  // Home screen extras
  const [firstName, setFirstName] = useState('')
  const [overdueReviews, setOverdueReviews] = useState([])
  const [reviewsExpanded, setReviewsExpanded] = useState(false)

  // Sidebar state
  const [activeSidebarSection, setActiveSidebarSection] = useState(null)
  const [analyticsTabRequest, setAnalyticsTabRequest] = useState(null)
  const [expandedSDs, setExpandedSDs] = useState(new Set())
  const [expandedCatDomains, setExpandedCatDomains] = useState(new Set())

  const [flaggedPoints, setFlaggedPoints] = useState(new Set())

  // Mobile sidebar
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [demoBannerVisible, setDemoBannerVisible] = useState(sessionStorage.getItem('demoBannerDismissed') !== 'true')

  // MAT / role state
  const [userRole, setUserRole] = useState('contributor')
  const [userMatId, setUserMatId] = useState(null)
  // 'school' | 'mat' | 'school_readonly'
  const [view, setView] = useState('school')

  // Personal view state — 'whole_school' | 'personal' | <userId UUID>
  const [viewMode, setViewMode] = useState('whole_school')
  const [personalAssignedPpIds, setPersonalAssignedPpIds] = useState(new Set())
  const [teamMembers, setTeamMembers] = useState([])
  const [browsingSchoolName, setBrowsingSchoolName] = useState('')

  // Onboarding / welcome state
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

  // Invite user modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('contributor')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)  // { type: 'success'|'error', text: string }
  const inviteModalRef = useRef(null)

  // Initialise auth: restore session and subscribe to changes.
  // Do NOT clear authLoading here — we wait until the profile fetch resolves
  // so the loading screen stays up until we know the correct initial view.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      // authLoading cleared by the session effect once profile is resolved
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] state change — event:', _event, '| user:', session?.user?.email ?? 'none')
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // When session changes: load profile (→ role + school) and domain structure.
  // authLoading is cleared here once we know which view to show.
  useEffect(() => {
    if (!session) {
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
      setOnboardingState(null)
      setFirstLoginPromptVisible(false)
      setSidebarFlashTeam(false)
      setWelcomed(true)
      setUserMatId(null)
      setView('school')
      setBrowsingSchoolName('')
      setAuthLoading(false)
      return
    }

    supabase
      .from('profiles')
      .select('school_id, role, mat_id, first_name, schools(name), onboarding_state, welcomed')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Profile] fetch error:', error)
          setAuthLoading(false)
          return
        }
        const role = data.role ?? 'contributor'
        console.log('[Profile] loaded — role:', role, '| mat_id:', data.mat_id, '| school_id:', data.school_id)
        setUserRole(role)
        setViewMode(role === 'contributor' ? 'personal' : 'whole_school')
        setUserMatId(data.mat_id ?? null)
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
              newPpInfoMap[pp.id] = { label: pp.label, domainId: domain.id, domainName: domain.name, subDomainName: sd.name }
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
      .select('total_pupils, pp_count, send_count, fsm_count, eal_count, lac_count, wwc_count')
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
          })
        }
        setCtxLoading(false)
      })
  }, [selectedSchool])

  // Overdue reviews for home screen reviews panel
  useEffect(() => {
    if (!selectedSchool) { setOverdueReviews([]); return }
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('entries')
      .select('provision_point_id, evidence_entries(id, provision_name, next_review_due)')
      .eq('school_id', selectedSchool)
      .then(({ data }) => {
        if (!data) return
        const overdue = []
        for (const entry of data) {
          for (const ev of entry.evidence_entries ?? []) {
            if (ev.next_review_due && ev.next_review_due <= today) {
              overdue.push({
                provisionPointId: entry.provision_point_id,
                provisionName:    ev.provision_name || '',
                nextReviewDue:    ev.next_review_due,
              })
            }
          }
        }
        overdue.sort((a, b) => a.nextReviewDue.localeCompare(b.nextReviewDue))
        setOverdueReviews(overdue)
        setReviewsExpanded(false)
      })
  }, [selectedSchool])

  // Fetch assigned provision point IDs for the personal view
  useEffect(() => {
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

  // Lightweight load: statuses + evidence counts + friction flags for all domains, current school
  useEffect(() => {
    if (!selectedSchool) { setAllStatuses({}); setAllEvidenceCounts({}); setFlaggedPoints(new Set()); return }
    supabase
      .from('entries')
      .select('provision_point_id, status, evidence_entries(id)')
      .eq('school_id', selectedSchool)
      .then(({ data, error }) => {
        if (error) { console.error('Error loading school data:', error); return }
        const statusMap = {}
        const evidenceMap = {}
        for (const e of data ?? []) {
          statusMap[e.provision_point_id] = e.status
          evidenceMap[e.provision_point_id] = (e.evidence_entries ?? []).length
        }
        setAllStatuses(statusMap)
        setAllEvidenceCounts(evidenceMap)
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
    if (!selectedSchool || !selectedDomain || selectedDomain === 'analytics' || selectedDomain === 'team' || selectedDomain === 'report-builder') {
      setSubDomains([])
      setEntries({})
      setEvidenceEntries({})
      setExpandedSDs(new Set())
      return
    }

    setLoading(true)

    Promise.all([
      supabase
        .from('sub_domains')
        .select('id, name, provision_points(id, label, display_order)')
        .eq('domain_id', selectedDomain)
        .order('name'),
      supabase
        .from('entries')
        .select(ENTRY_SELECT)
        .eq('school_id', selectedSchool),
    ]).then(([subDomainsRes, entriesRes]) => {
      if (subDomainsRes.error) console.error('Error loading sub_domains:', subDomainsRes.error)
      if (entriesRes.error) console.error('Error loading entries:', entriesRes.error)

      const grouped = (subDomainsRes.data ?? []).map(sd => ({
        ...sd,
        provision_points: (sd.provision_points ?? []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }))

      const entryMap = {}
      const evidenceMap = {}
      for (const { provision_point_id, evidence_entries: evList, ...rest } of entriesRes.data ?? []) {
        entryMap[provision_point_id] = rest
        evidenceMap[provision_point_id] = evList ?? []
      }

      setSubDomains(grouped)
      setEntries(entryMap)
      setEvidenceEntries(evidenceMap)
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
    setInviteEmail('')
    setInviteRole('contributor')
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
        email:     inviteEmail,
        role:      inviteRole,
        school_id: selectedSchool,
        mat_id:    userMatId,
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
      } else {
        setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail}.` })
        setInviteEmail('')
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
    setSchoolCtx(updated)
    await supabase.from('school_context').upsert({
      school_id:    selectedSchool,
      total_pupils: updated.totalPupils,
      pp_count:     updated.ppCount,
      send_count:   updated.sendCount,
      fsm_count:    updated.fsmCount,
      eal_count:    updated.ealCount,
      lac_count:    updated.lacCount,
      wwc_count:    updated.wwcCount,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'school_id' })
  }

  async function handleFlag(ppId, note) {
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

  async function handleStatusChange(ppId, status) {
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

  async function handleModalSave() {
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
    const { data: saved, error: saveError } = draftId
      ? await supabase.from('evidence_entries').update(draft).eq('id', draftId).select().single()
      : await supabase.from('evidence_entries').insert([{ entry_id: entryRow.id, ...draft }]).select().single()

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

  const readOnly = view === 'school_readonly'
  const isDemoMode = sessionStorage.getItem('isDemoMode') === 'true'

  const allPoints = subDomains.flatMap(sd => sd.provision_points)
  const answeredCount = allPoints.filter(p => entries[p.id]?.status).length
  const progress = allPoints.length ? Math.round((answeredCount / allPoints.length) * 100) : 0

  // /demo must be the very first route evaluated — before any auth guard,
  // before authLoading, before the catch-all login form. startsWith handles
  // trailing-slash normalisations (/demo/) added by Vercel or mobile browsers.
  const pathname = pathnameRef.current

  console.log('[App routing] evaluating — pathname:', pathname, '| demoEntry:', sessionStorage.getItem('demoEntry'), '| session:', !!session, '| authLoading:', authLoading, '| userRole:', userRole)

  if (pathname.startsWith('/demo')) {
    return <DemoAutoLogin />
  }

  // Public static pages — no auth required
  if (pathname === '/about') return <AboutPage />
  if (pathname === '/privacy') return <PrivacyPage />

  if (authLoading) {
    return <LoadingScreen />
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

        {readOnly && !(isDemoMode) && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 4,
          }}>
            <span style={{ fontSize: '1rem' }}>👁</span>
            <p style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 500 }}>
              Viewing <strong>{browsingSchoolName}</strong> — read only. Changes cannot be made from the MAT dashboard.
            </p>
          </div>
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
                <div style={{ display: 'inline-flex', background: '#E2E8F0', borderRadius: 8, padding: 3, gap: 2, alignSelf: 'flex-start' }}>
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
                      Welcome — your provision points are ready.
                    </p>
                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
                      Your headteacher has assigned provision points to you. Explore them below, add evidence, and track progress.
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
                </div>

                {/* Right: reviews due — filtered in personal view, hidden if none */}
                {reviewsDueCount > 0 && (
                  <div style={{
                    width: 248, flexShrink: 0,
                    background: '#F0FDFA', border: '1px solid #99f6e4', borderRadius: 12, padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>
                      {reviewsDueCount} review{reviewsDueCount !== 1 ? 's' : ''} due
                    </p>
                    <div style={{ overflowY: 'auto', maxHeight: 210, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filteredReviews.map((r, i) => {
                        const info       = ppInfoMap[r.provisionPointId]
                        const domainId   = info?.domainId
                        const domainName = info?.domainName ?? ''
                        const label      = r.provisionName || info?.label || 'Untitled'
                        const dateStr    = new Date(r.nextReviewDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        return (
                          <button key={i} type="button"
                            onClick={() => domainId && setSelectedDomain(domainId)}
                            style={{
                              background: 'rgba(255,255,255,0.6)', border: '1px solid #99f6e4', borderRadius: 8,
                              padding: '8px 10px', textAlign: 'left', cursor: domainId ? 'pointer' : 'default',
                              fontFamily: 'inherit', flexShrink: 0,
                            }}
                          >
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#134e4a', lineHeight: 1.35, marginBottom: 3 }}>{label}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <p style={{ fontSize: '0.7rem', color: '#0f766e' }}>{domainName}</p>
                              <p style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>{dateStr}</p>
                            </div>
                          </button>
                        )
                      })}
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
          <AnalyticsView school={selectedSchool} supabase={supabase} schoolName={schoolName} tabRequest={analyticsTabRequest} schoolCtx={schoolCtx} onSave={handleCtxSave} ctxLoading={ctxLoading}
            onNavigateToCategory={cat => { setSelectedDomain(''); setAnalyticsTabRequest(null); setOverviewMode('category'); setSelectedCategory(cat) }}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain === 'report-builder' && (
          <ReportBuilder
            schoolName={schoolName}
            allSubDomains={allSubDomains}
            supabase={supabase}
            school={selectedSchool}
            schoolCtx={schoolCtx}
          />
        )}

        {view !== 'mat' && selectedSchool && selectedDomain === 'team' && (userRole === 'approver' || userRole === 'mat_admin') && (
          <TeamPage
            schoolId={selectedSchool}
            currentUserId={session.user.id}
            supabase={supabase}
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

        {view !== 'mat' && selectedSchool && selectedDomain && selectedDomain !== 'analytics' && selectedDomain !== 'report-builder' && selectedDomain !== 'team' && (
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

                {/* Sub-domain collapsible sections */}
                {subDomains.map(sd => {
                  const isExpanded = expandedSDs.has(sd.id)
                  const pps = sd.provision_points
                  const ppCount = pps.length
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
                  const showDates        = isStudentFacing || isWholeSchool || isLegacy

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
                            <label>Date Last Reviewed</label>
                            <input type="date" value={draft.date_last_reviewed ?? ''} onChange={e => handleDraftChange('date_last_reviewed', e.target.value || null)} />
                          </div>
                          <div className="df df--half">
                            <label>Next Review Due</label>
                            <input type="date" value={draft.next_review_due ?? ''} onChange={e => handleDraftChange('next_review_due', e.target.value || null)} />
                          </div>
                          <div className="df df--half">
                            <label>Review Cycle</label>
                            <select value={draft.review_cycle ?? ''} onChange={e => handleDraftChange('review_cycle', e.target.value)}>
                              <option value="">—</option>
                              {REVIEW_CYCLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
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
                <div className="df df--half">
                  <label htmlFor="invite-role">Role</label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                  >
                    <option value="contributor">Contributor</option>
                    <option value="approver">Approver</option>
                  </select>
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
