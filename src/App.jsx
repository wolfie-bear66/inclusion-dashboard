import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

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
  'evidence_entries(id, provision_name, brief_description, indicator_type, named_role_policy_document, delivered_by, send_tiers, pupils_reached, grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other, date_started, date_last_reviewed, next_review_due, funding_source, cost, review_cycle, evidence_notes, intended_outcomes, impact_on_outcomes, supporting_document_link, notes)',
].join(', ')

// ── Analytics sub-components ─────────────────────────────────────
const ACard = ({ children, className = '' }) => (
  <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 24 }} className={className}>{children}</div>
)
const ASectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 20 }}>
    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', letterSpacing: '-0.2px' }}>{children}</h2>
    {sub && <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>{sub}</p>}
  </div>
)
const AGroupPill = ({ label }) => (
  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#64748b', fontWeight: 500, display: 'inline-block' }}>{label}</span>
)

const DOMAIN_COLOUR_MAP = [
  { key: 'SEND',       colour: '#6366f1' },
  { key: 'Equity',     colour: '#f59e0b' },
  { key: 'Attendance', colour: '#ec4899' },
  { key: 'Enrichment', colour: '#14b8a6' },
  { key: 'Belonging',  colour: '#f97316' },
  { key: 'Wellbeing',  colour: '#84cc16' },
]
const A_FALLBACK_COLOURS = ['#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#84cc16']
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
  { id: 'equity',    label: 'Enrichment Equity' },
  { id: 'funding',   label: 'Funding & Cost' },
  { id: 'outcomes',  label: 'Outcomes & Impact' },
]

function AnalyticsView({ school, supabase: sb }) {
  const [analyticsEntries, setAnalyticsEntries] = useState([])
  const [domains, setDomains] = useState([])
  const [aLoading, setALoading] = useState(true)
  const [activeTab, setActiveTab] = useState('readiness')
  const [schoolCtx, setSchoolCtx] = useState(() => {
    try {
      const stored = localStorage.getItem('analytics_ctx_' + school)
      if (stored) return JSON.parse(stored)
    } catch {}
    return { totalPupils: 0, ppCount: 0, sendCount: 0, fsmCount: 0, ealCount: 0, lacCount: 0, wwcCount: 0 }
  })
  const [editingCtx, setEditingCtx] = useState(false)
  const [ctxDraft, setCtxDraft] = useState({})

  useEffect(() => {
    setALoading(true)
    Promise.all([
      sb.from('entries')
        .select(`
          id, provision_point_id, status,
          grp_send, grp_pp, grp_eal, grp_fsm, grp_lac, grp_wwc, grp_other,
          provision_points(*, sub_domains(*, domains(id, name))),
          evidence_entries(id, provision_name, funding_source, cost, next_review_due,
            evidence_notes, intended_outcomes, impact_on_outcomes,
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

  const today = new Date()

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

  // ── Inner tab views ───────────────────────────────────────────────
  function DomainReadiness() {
    const grandTotal   = readinessData.reduce((s, d) => s + d.total, 0)
    const grandInPlace = readinessData.reduce((s, d) => s + d.inPlace, 0)
    const overallPct   = grandTotal ? Math.round((grandInPlace / grandTotal) * 100) : 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ACard>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{overallPct}%</span>
            <div style={{ paddingBottom: 6 }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Overall readiness</p>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{grandInPlace} of {grandTotal} indicators In Place</p>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: '#f1f5f9', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, borderRadius: 6, background: '#10b981', transition: 'width 0.5s' }} />
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
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{d.fullName}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {d.inPlace} in place · {d.inProgress} in progress · {d.notInPlace} not started
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
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
                const bg  = ev.urgency === 'urgent' ? '#fef2f2' : ev.urgency === 'soon' ? '#fffbeb' : '#f8fafc'
                const col = ev.urgency === 'urgent' ? '#dc2626' : ev.urgency === 'soon' ? '#d97706' : '#475569'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: bg }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

  function EnrichmentEquity() {
    const EQ_GROUPS = [
      { key: 'grp_pp',   label: 'Pupil Premium',      ctxKey: 'ppCount' },
      { key: 'grp_send', label: 'SEND',                ctxKey: 'sendCount' },
      { key: 'grp_fsm',  label: 'FSM',                 ctxKey: 'fsmCount' },
      { key: 'grp_wwc',  label: 'White Working Class', ctxKey: 'wwcCount' },
      { key: 'grp_eal',  label: 'EAL',                 ctxKey: 'ealCount' },
    ]
    const [selectedGroup, setSelectedGroup] = useState(EQ_GROUPS[0].label)

    if (equityData.length === 0) return (
      <ACard>
        <ASectionTitle sub="Enrichment provision coverage broken down by student group">Enrichment Equity</ASectionTitle>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No enrichment entries found.</p>
      </ACard>
    )

    const radarData = equityData.map(sd => ({
      subject: sd.subDomain,
      [selectedGroup]: sd.groups.find(g => g.label === selectedGroup)?.pct ?? 0,
      'All Pupils': 100,
    }))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EQ_GROUPS.map(g => (
            <button key={g.label} type="button" onClick={() => setSelectedGroup(g.label)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '0.8rem',
                borderColor: selectedGroup === g.label ? '#14b8a6' : '#e2e8f0',
                background:  selectedGroup === g.label ? '#f0fdfa' : '#fff',
                color:       selectedGroup === g.label ? '#0d9488' : '#475569',
                fontWeight:  selectedGroup === g.label ? 600 : 400,
              }}>
              {g.label} ({schoolCtx[g.ctxKey] || '—'})
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ACard>
            <ASectionTitle sub={`${selectedGroup} vs all pupils across enrichment sub-domains`}>Coverage Radar</ASectionTitle>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar name="All Pupils" dataKey="All Pupils" stroke="#e2e8f0" fill="#e2e8f0" fillOpacity={0.3} />
                <Radar name={selectedGroup} dataKey={selectedGroup} stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.5} />
                <Tooltip formatter={v => `${v}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </ACard>

          <ACard>
            <ASectionTitle sub="% of provision points targeting the selected group per sub-domain">By Sub-domain</ASectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {equityData.map((sd, i) => {
                const grp = sd.groups.find(g => g.label === selectedGroup)
                const pct = grp?.pct ?? 0
                const gap = 100 - pct
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.78rem', color: '#475569' }}>{sd.subDomain}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {gap > 15 && (
                          <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            ⚠ {gap}pt gap
                          </span>
                        )}
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#14b8a6', transition: 'width 0.4s' }} />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3 }}>{grp?.count ?? 0} of {sd.total} provision points</p>
                  </div>
                )
              })}
            </div>
          </ACard>
        </div>
      </div>
    )
  }

  function FundingCost() {
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
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{s.value}</p>
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
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Funding Streams</p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>Spend proportion by source</p>
              </div>
              <button type="button" onClick={() => setShowFundingInputs(v => !v)}
                style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>£{fs.value.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#6366f1', transition: 'width 0.4s' }} />
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

  function OutcomesImpact() {
    const [filterMode, setFilterMode]   = useState('domain')
    const [activeFilter, setActiveFilter] = useState(null)

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
        }
      })

    const filterOptions = filterMode === 'domain'
      ? [...new Set(allItems.map(i => i.domain).filter(Boolean))]
      : filterMode === 'group'
      ? [...new Set(allItems.flatMap(i => i.groups))]
      : [...new Set(allItems.map(i => i.subDomain).filter(Boolean))]

    const filtered = activeFilter
      ? filterMode === 'domain'    ? allItems.filter(i => i.domain === activeFilter)
      : filterMode === 'group'     ? allItems.filter(i => i.groups.includes(activeFilter))
                                   : allItems.filter(i => i.subDomain === activeFilter)
      : allItems

    if (allItems.length === 0) return (
      <ACard>
        <ASectionTitle sub="Intended outcomes and evidence of impact">Outcomes & Impact</ASectionTitle>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No outcomes or impact data recorded yet.</p>
      </ACard>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, alignSelf: 'flex-start' }}>
          {[['domain','By Domain'],['group','By Group'],['subdomain','By Sub-domain']].map(([mode, label]) => (
            <button key={mode} type="button"
              onClick={() => { setFilterMode(mode); setActiveFilter(null) }}
              style={{
                padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer',
                fontWeight:  filterMode === mode ? 600 : 400,
                color:       filterMode === mode ? '#1e293b' : '#64748b',
                background:  filterMode === mode ? '#fff' : 'transparent',
                boxShadow:   filterMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setActiveFilter(null)}
            style={{
              padding: '4px 12px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '0.78rem',
              borderColor: !activeFilter ? '#3b82f6' : '#e2e8f0',
              background:  !activeFilter ? '#eff6ff' : '#fff',
              color:       !activeFilter ? '#1d4ed8' : '#64748b',
              fontWeight:  !activeFilter ? 600 : 400,
            }}>
            All
          </button>
          {filterOptions.map(opt => (
            <button key={opt} type="button" onClick={() => setActiveFilter(opt === activeFilter ? null : opt)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '0.78rem',
                borderColor: activeFilter === opt ? '#3b82f6' : '#e2e8f0',
                background:  activeFilter === opt ? '#eff6ff' : '#fff',
                color:       activeFilter === opt ? '#1d4ed8' : '#64748b',
                fontWeight:  activeFilter === opt ? 600 : 400,
              }}>
              {opt}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{filtered.length} outcome{filtered.length !== 1 ? 's' : ''}</p>

        {filtered.length === 0
          ? <ACard><p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No outcomes match this filter.</p></ACard>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((item, i) => (
                <ACard key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: item.intended || item.impact ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.colour, flexShrink: 0, marginTop: 4 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.name}</p>
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
                    <div>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Evidence of impact</p>
                      <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>{item.impact}</p>
                    </div>
                  )}
                </ACard>
              ))}
            </div>
          )
        }
      </div>
    )
  }

  if (aLoading) return <p className="state-msg">Loading analytics…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* School context panel */}
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
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{f.value || '—'}</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editingCtx) {
                const updated = { ...ctxDraft }
                setSchoolCtx(updated)
                localStorage.setItem('analytics_ctx_' + school, JSON.stringify(updated))
              } else {
                setCtxDraft({ ...schoolCtx })
              }
              setEditingCtx(v => !v)
            }}
            style={{ fontSize: '0.78rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', flexShrink: 0 }}
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
                  onBlur={() => setSchoolCtx({ ...ctxDraft })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inner tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
        {ANALYTICS_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, padding: '7px 12px', border: 'none', borderRadius: 7,
              fontSize: '0.8rem',
              fontWeight: activeTab === t.id ? 600 : 400,
              color:      activeTab === t.id ? '#1e293b' : '#64748b',
              background: activeTab === t.id ? '#fff' : 'transparent',
              boxShadow:  activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'readiness' && <DomainReadiness />}
      {activeTab === 'equity'    && <EnrichmentEquity />}
      {activeTab === 'funding'   && <FundingCost />}
      {activeTab === 'outcomes'  && <OutcomesImpact />}
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

  // Modal state
  const [modalPoint, setModalPoint] = useState(null)
  const [draft, setDraft] = useState({})
  const [draftId, setDraftId] = useState(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalSaveMsg, setModalSaveMsg] = useState(null)
  const [modalSaveError, setModalSaveError] = useState(false)
  const modalRef = useRef(null)

  // Initialise auth: restore session and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // When session changes: load profile (→ school) and domain structure
  useEffect(() => {
    if (!session) {
      setSelectedSchool('')
      setSchoolName('')
      setDomains([])
      setPpDomainMap({})
      setDomainTotals({})
      setAllStatuses({})
      setAllEvidenceCounts({})
      return
    }

    supabase
      .from('profiles')
      .select('school_id, schools(name)')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.school_id) { console.error('Error loading profile:', error); return }
        setSelectedSchool(data.school_id)
        setSchoolName(data.schools?.name ?? '')
      })

    supabase
      .from('domains')
      .select('id, name, display_order, sub_domains(provision_points(id))')
      .order('display_order')
      .then(({ data, error }) => {
        if (error) { console.error('Error loading domains:', error); return }
        const newPpDomainMap = {}
        const newDomainTotals = {}
        for (const domain of data ?? []) {
          let count = 0
          for (const sd of domain.sub_domains ?? []) {
            for (const pp of sd.provision_points ?? []) {
              newPpDomainMap[pp.id] = domain.id
              count++
            }
          }
          newDomainTotals[domain.id] = count
        }
        setDomains((data ?? []).map(({ sub_domains: _sd, ...d }) => d))
        setPpDomainMap(newPpDomainMap)
        setDomainTotals(newDomainTotals)
      })
  }, [session])

  // Lightweight load: statuses + evidence counts for all domains, current school
  useEffect(() => {
    if (!selectedSchool) { setAllStatuses({}); setAllEvidenceCounts({}); return }
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
  }, [selectedSchool])

  useEffect(() => {
    if (!selectedSchool || !selectedDomain || selectedDomain === 'analytics') {
      setSubDomains([])
      setEntries({})
      setEvidenceEntries({})
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

  useEffect(() => {
    document.body.style.overflow = modalPoint ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalPoint])

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

  async function handleLogout() {
    await supabase.auth.signOut()
    setSelectedDomain('')
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

  const allPoints = subDomains.flatMap(sd => sd.provision_points)
  const answeredCount = allPoints.filter(p => entries[p.id]?.status).length
  const progress = allPoints.length ? Math.round((answeredCount / allPoints.length) * 100) : 0

  if (authLoading) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">Inclusion Dashboard</h1>
          <p className="login-sub">Sign in to continue</p>
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
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">Inclusion Dashboard</h1>
          {schoolName && <p className="header-sub">{schoolName}</p>}
        </div>
        <button type="button" className="logout-btn" onClick={handleLogout}>Sign out</button>
      </header>

      <main className="main">

        <nav className="domain-nav" aria-label="Domains">
          <button
            type="button"
            className={`domain-tab domain-tab--overview${!selectedDomain ? ' domain-tab--active' : ''}`}
            onClick={() => setSelectedDomain('')}
          >
            <span className="domain-tab-name">Overview</span>
            <span className="domain-tab-count">{Object.keys(ppDomainMap).length > 0 ? `${Object.values(allStatuses).filter(Boolean).length}/${Object.keys(ppDomainMap).length}` : '—'}</span>
          </button>
          <button
            type="button"
            className={`domain-tab domain-tab--overview${selectedDomain === 'analytics' ? ' domain-tab--active' : ''}`}
            onClick={() => setSelectedDomain('analytics')}
          >
            <span className="domain-tab-name">Analytics</span>
          </button>
          {domains.map(d => {
            const total = domainTotals[d.id] ?? 0
            const answered = Object.entries(ppDomainMap).filter(
              ([ppId, domId]) => domId === d.id && allStatuses[ppId]
            ).length
            return (
              <button
                key={d.id}
                type="button"
                className={`domain-tab${selectedDomain === d.id ? ' domain-tab--active' : ''}`}
                onClick={() => setSelectedDomain(d.id)}
              >
                <span className="domain-tab-name">{d.name}</span>
                <span className="domain-tab-count">{answered}/{total}</span>
              </button>
            )
          })}
        </nav>

        {selectedSchool && !selectedDomain && (() => {
          const allPpIds = Object.keys(ppDomainMap)
          const totTotal    = allPpIds.length
          const totInPlace  = allPpIds.filter(id => allStatuses[id] === 'in_place').length
          const totInProg   = allPpIds.filter(id => allStatuses[id] === 'in_progress').length
          const totNotIn    = allPpIds.filter(id => allStatuses[id] === 'not_in_place').length
          const totEvidence = allPpIds.filter(id => (allEvidenceCounts[id] ?? 0) > 0).length
          return (
            <div className="dashboard">
              <div className="dash-summary">
                <div className="dash-stat">
                  <span className="dash-stat-value">{totTotal}</span>
                  <span className="dash-stat-label">Total Points</span>
                </div>
                <div className="dash-stat dash-stat--green">
                  <span className="dash-stat-value">{totInPlace}</span>
                  <span className="dash-stat-label">In Place</span>
                </div>
                <div className="dash-stat dash-stat--amber">
                  <span className="dash-stat-value">{totInProg}</span>
                  <span className="dash-stat-label">In Progress</span>
                </div>
                <div className="dash-stat dash-stat--red">
                  <span className="dash-stat-value">{totNotIn}</span>
                  <span className="dash-stat-label">Not In Place</span>
                </div>
                <div className="dash-stat dash-stat--blue">
                  <span className="dash-stat-value">{totEvidence}</span>
                  <span className="dash-stat-label">With Evidence</span>
                </div>
              </div>

              <div className="dash-grid">
                {domains.map(d => {
                  const ppIds    = Object.entries(ppDomainMap).filter(([, did]) => did === d.id).map(([id]) => id)
                  const total    = ppIds.length
                  const inPlace  = ppIds.filter(id => allStatuses[id] === 'in_place').length
                  const inProg   = ppIds.filter(id => allStatuses[id] === 'in_progress').length
                  const notIn    = ppIds.filter(id => allStatuses[id] === 'not_in_place').length
                  const answered = inPlace + inProg + notIn
                  const evidence = ppIds.filter(id => (allEvidenceCounts[id] ?? 0) > 0).length
                  const pct      = total ? Math.round((answered / total) * 100) : 0
                  return (
                    <button key={d.id} type="button" className="dash-card" onClick={() => setSelectedDomain(d.id)}>
                      <h3 className="dash-card-name">{d.name}</h3>
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
                      <div className="dash-evidence">
                        <span className="dash-evidence-icon">◆</span>
                        {evidence} provision point{evidence !== 1 ? 's' : ''} with evidence
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {selectedSchool && selectedDomain === 'analytics' && (
          <AnalyticsView school={selectedSchool} supabase={supabase} />
        )}

        {selectedSchool && selectedDomain && selectedDomain !== 'analytics' && (
          loading ? (
            <p className="state-msg">Loading…</p>
          ) : subDomains.length === 0 ? (
            <p className="state-msg">No provision points found for this domain.</p>
          ) : (
            <>
              <div className="progress-wrap">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-label">{answeredCount} / {allPoints.length} answered</span>
              </div>

              {subDomains.map(sd => (
                <section key={sd.id} className="subdomain">
                  <h2 className="subdomain-title">{sd.name}</h2>
                  <div className="provision-list">
                    {sd.provision_points.map(pp => {
                      const entry = entries[pp.id] ?? {}
                      const evList = evidenceEntries[pp.id] ?? []
                      return (
                        <div key={pp.id} className="provision-item">

                          <div className="provision-row">
                            <span className="provision-name">{pp.label}</span>
                            {evList.length > 0 && (
                              <span className="evidence-count-badge" title={`${evList.length} evidence ${evList.length === 1 ? 'entry' : 'entries'}`}>
                                {evList.length}
                              </span>
                            )}
                            <div className="provision-actions">
                              <div className="status-group">
                                {STATUSES.map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`status-btn status-btn--${s.replace(/_/g, '-')}${entry.status === s ? ' active' : ''}`}
                                    onClick={() => handleStatusChange(pp.id, s)}
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                              <button type="button" className="evidence-btn" onClick={() => openModal(pp)}>
                                Add Evidence
                              </button>
                            </div>
                          </div>

                          {evList.length > 0 && (
                            <ul className="evidence-list">
                              {evList.map(ev => (
                                <li key={ev.id}>
                                  <button
                                    type="button"
                                    className="evidence-list-item"
                                    onClick={() => openModal(pp, ev)}
                                  >
                                    {ev.provision_name || 'Untitled entry'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </>
          )
        )}
      </main>

      {modalPoint && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" ref={modalRef} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2 className="modal-title">{modalPoint.label}</h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">

                <div className="df df--half">
                  <label>Provision Name</label>
                  <input type="text" value={draft.provision_name ?? ''} onChange={e => handleDraftChange('provision_name', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Indicator Type</label>
                  <select value={draft.indicator_type ?? ''} onChange={e => handleDraftChange('indicator_type', e.target.value)}>
                    <option value="">—</option>
                    {INDICATOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="df df--full">
                  <label>Brief Description</label>
                  <textarea rows={2} value={draft.brief_description ?? ''} onChange={e => handleDraftChange('brief_description', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Named Role / Policy / Document</label>
                  <input type="text" value={draft.named_role_policy_document ?? ''} onChange={e => handleDraftChange('named_role_policy_document', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Delivered By</label>
                  <input type="text" value={draft.delivered_by ?? ''} onChange={e => handleDraftChange('delivered_by', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>SEND Tiers</label>
                  <div className="tier-checkbox-group">
                    {SEND_TIERS.map(t => {
                      const selected = Array.isArray(draft.send_tiers) ? draft.send_tiers : []
                      const checked = selected.includes(t.value)
                      return (
                        <label key={t.value} className="tier-checkbox-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selected.filter(v => v !== t.value)
                                : [...selected, t.value]
                              handleDraftChange('send_tiers', next)
                            }}
                          />
                          {t.label}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="df df--half">
                  <label>Student Groups</label>
                  <div className="tier-checkbox-group">
                    {EV_GROUPS.map(g => (
                      <label key={g.value} className="tier-checkbox-label">
                        <input
                          type="checkbox"
                          checked={draft[g.value] ?? false}
                          onChange={e => handleDraftChange(g.value, e.target.checked)}
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="df df--quarter">
                  <label>Pupils / People Reached</label>
                  <input
                    type="number" min="0" step="1"
                    value={draft.pupils_reached ?? ''}
                    onChange={e => handleDraftChange('pupils_reached', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>

                <div className="df df--quarter">
                  <label>Annual Cost £</label>
                  <input
                    type="number" min="0" step="1"
                    value={draft.cost ?? ''}
                    onChange={e => handleDraftChange('cost', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>

                <div className="df df--half">
                  <label>Funding Source</label>
                  <select value={draft.funding_source ?? ''} onChange={e => handleDraftChange('funding_source', e.target.value)}>
                    <option value="">—</option>
                    {FUNDING_SOURCES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

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

                <div className="df df--full">
                  <label>Intended Outcomes</label>
                  <span className="field-hint">What barriers are you aiming to remove for this group?</span>
                  <textarea rows={3} placeholder="Describe the intended outcome for the pupils this entry targets..." value={draft.intended_outcomes ?? ''} onChange={e => handleDraftChange('intended_outcomes', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Impact on Outcomes</label>
                  <textarea rows={3} value={draft.impact_on_outcomes ?? ''} onChange={e => handleDraftChange('impact_on_outcomes', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Evidence of Impact</label>
                  <textarea rows={3} value={draft.evidence_notes ?? ''} onChange={e => handleDraftChange('evidence_notes', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Supporting Document Link</label>
                  <input type="url" placeholder="https://…" value={draft.supporting_document_link ?? ''} onChange={e => handleDraftChange('supporting_document_link', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Notes</label>
                  <textarea rows={2} value={draft.notes ?? ''} onChange={e => handleDraftChange('notes', e.target.value)} />
                </div>

              </div>
            </div>

            <div className="modal-footer">
              {draftId && (
                <button type="button" className="delete-btn" onClick={handleModalDelete} disabled={modalSaving}>
                  Delete
                </button>
              )}
              <div className="modal-footer-right">
                {modalSaveMsg && (
                  <span className={`save-msg${modalSaveError ? ' save-msg--error' : ' save-msg--ok'}`}>
                    {modalSaveMsg}
                  </span>
                )}
                <button type="button" className="modal-cancel-btn" onClick={closeModal}>Close</button>
                <button type="button" className="save-btn" onClick={handleModalSave} disabled={modalSaving}>
                  {modalSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
