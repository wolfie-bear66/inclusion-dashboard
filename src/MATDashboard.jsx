import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ── Domain colour identity palette ────────────────────────────────────
const DOMAIN_COLOURS = [
  { key: 'SEND',       colour: '#4338CA' },
  { key: 'Equity',     colour: '#7A5C13' },
  { key: 'Attendance', colour: '#0E6251' },
  { key: 'Enrichment', colour: '#6B21A8' },
  { key: 'Belonging',  colour: '#334E68' },
  { key: 'Wellbeing',  colour: '#5B3A9C' },
]
const FALLBACK_COLOURS = DOMAIN_COLOURS.map(d => d.colour)
function domainColour(name = '', idx = 0) {
  const m = DOMAIN_COLOURS.find(d => name.includes(d.key))
  return m ? m.colour : FALLBACK_COLOURS[idx % FALLBACK_COLOURS.length]
}

function ragColour(pct) {
  if (pct === null || pct === undefined) return '#94a3b8'
  if (pct >= 70) return '#257A3B'
  if (pct >= 40) return '#D4751A'
  return '#EA4335'
}

// ── Sidebar ───────────────────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { id: 'home',       icon: 'ti-home',           label: 'Home' },
  { id: 'schools',    icon: 'ti-building',        label: 'Schools' },
  { id: 'domains',    icon: 'ti-layout-grid',     label: 'Domains' },
  { id: 'categories', icon: 'ti-tag',             label: 'Categories' },
  { id: 'barriers',   icon: 'ti-alert-triangle',  label: 'Barriers' },
  { id: 'analytics',  icon: 'ti-chart-bar',       label: 'Analytics' },
]

const BARRIER_GROUP_LABELS = {
  send:  'SEND',
  pp:    'Pupil Premium',
  eal:   'EAL',
  fsm:   'FSM',
  lac:   'LAC',
  wwc:   'White Working Class',
  other: 'Other',
}

function barrierStatusBadge(status) {
  if (status === 'active')          return { bg: '#FEF3C7', text: '#92400E', label: 'Active' }
  if (status === 'being_addressed') return { bg: '#DBEAFE', text: '#1E3A8A', label: 'Being Addressed' }
  return { bg: '#DCFCE7', text: '#166534', label: 'Resolved' }
}

function MatSidebar({ activeView, setActiveView, matName, onNavClick }) {
  const [hovered, setHovered] = useState(null)

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid #E2E8F0',
      background: '#F0F2F5',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo area */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '0.5px solid #E2E8F0', flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A202C', lineHeight: 1.3 }}>
          {matName || 'MAT Dashboard'}
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Multi-Academy Trust</p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, paddingTop: 6 }}>
        {SIDEBAR_ITEMS.map(item => {
          const active = activeView === item.id
          const isH = hovered === item.id
          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { setActiveView(item.id); onNavClick?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '8px 14px',
                border: 'none', borderLeft: `3px solid ${active ? '#1B365D' : 'transparent'}`,
                background: active ? 'rgba(27,54,93,0.10)' : isH ? 'rgba(0,0,0,0.04)' : 'transparent',
                color: active ? '#1B365D' : '#334155',
                fontSize: '0.83rem', fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: '1rem', flexShrink: 0, color: active ? '#1B365D' : '#94a3b8', lineHeight: 1 }} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

// ── RAG hairline bars (school card) ──────────────────────────────────
function RAGHairlineBars({ inPlace, inProgress, notInPlace, total }) {
  const denom = total || 1
  const bars = [
    { width: (inPlace     / denom) * 100, colour: '#4CAF50' },
    { width: (inProgress  / denom) * 100, colour: '#F59E0B' },
    { width: (notInPlace  / denom) * 100, colour: '#EF4444' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${b.width}%`, background: b.colour, borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
      ))}
    </div>
  )
}

// ── Home view ─────────────────────────────────────────────────────────
function HomeView({ matName, schools, domains, matrix, activePpCount, reviewsDue, onSchoolClick, isDemoMode, isMobile }) {
  // Trust-wide stats
  const totalSchools = schools.length
  const totalPossible = activePpCount * totalSchools
  const totalInPlace = schools.reduce((sum, s) =>
    sum + domains.reduce((ds, d) => ds + (matrix[s.id]?.[d.id]?.inPlace ?? 0), 0), 0)
  const trustPct = totalPossible ? Math.round((totalInPlace / totalPossible) * 100) : null

  // Per-school stats
  function schoolStats(s) {
    const inPlace    = domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.inPlace    ?? 0), 0)
    const inProgress = domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.inProgress ?? 0), 0)
    const notInPlace = domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.notInPlace ?? 0), 0)
    const total      = activePpCount || domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.total ?? 0), 0)
    const pct        = total ? Math.round((inPlace / total) * 100) : null
    return { inPlace, inProgress, notInPlace, total, pct }
  }

  // School cards sorted highest in_place first (left = best performing)
  const sortedSchools = [...schools].sort((a, b) => {
    const aIn = domains.reduce((s, d) => s + (matrix[a.id]?.[d.id]?.inPlace ?? 0), 0)
    const bIn = domains.reduce((s, d) => s + (matrix[b.id]?.[d.id]?.inPlace ?? 0), 0)
    return bIn - aIn
  })

  // Attention panel: schools with any domain below 40%, gaps ordered lowest % first
  const attentionSchools = schools
    .map(s => {
      const lowDomains = domains
        .map(d => {
          const cell = matrix[s.id]?.[d.id]
          if (!cell?.total) return null
          const pct = Math.round((cell.inPlace / cell.total) * 100)
          return pct < 40 ? { domain: d, pct } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.pct - b.pct)
      return lowDomains.length > 0 ? { school: s, lowDomains } : null
    })
    .filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Zone 1: Trust header */}
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
        padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Multi-Academy Trust
        </p>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1B365D', marginBottom: 4 }}>{matName}</h2>
        <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: 20 }}>
          {totalSchools} school{totalSchools !== 1 ? 's' : ''} · {domains.length} domains
        </p>
        {trustPct !== null && (
          <div>
            <span style={{ fontSize: '2.4rem', fontWeight: 700, color: '#1B365D', lineHeight: 1 }}>{trustPct}%</span>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: 6 }}>
              {totalInPlace} of {totalPossible} provision points evidenced across {totalSchools} school{totalSchools !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Zone 2: School cards */}
      {isDemoMode && (
        <p style={{ fontSize: '0.82rem', color: '#6B7280', fontStyle: 'italic', marginBottom: -8 }}>
          Explore either school to see how Inclusion Dashboard works in practice — one model school, one that needs attention.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {sortedSchools.map(s => {
          const { inPlace, inProgress, notInPlace, total, pct } = schoolStats(s)
          const rag = ragColour(pct)
          return (
            <div key={s.id} style={{
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
              padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1B365D', margin: 0 }}>{s.name}</h3>

              {pct !== null ? (
                <p style={{ fontSize: '1.9rem', fontWeight: 800, color: rag, lineHeight: 1, margin: 0 }}>{pct}%</p>
              ) : (
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>No data recorded yet</p>
              )}

              <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: 0 }}>
                {inPlace} of {total || '—'} provision points
              </p>

              <RAGHairlineBars inPlace={inPlace} inProgress={inProgress} notInPlace={notInPlace} total={total} />

              <button
                type="button"
                onClick={() => onSchoolClick(s.id, s.name, '')}
                style={{
                  background: '#1B365D', color: '#fff',
                  border: 'none', borderRadius: 8, width: '100%',
                  padding: '9px 0', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
                }}
              >
                Explore school →
              </button>
            </div>
          )
        })}
      </div>

      {/* Zone 3: Attention + Reviews */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 16,
      }}>

        {/* Needs attention */}
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1B365D', marginBottom: 14 }}>
            Needs attention across the trust
          </h3>
          {attentionSchools.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#6B7280' }}>
              No gaps identified — all schools are above 40% across all domains.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {attentionSchools.map(({ school, lowDomains }) => (
                <div key={school.id}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A202C', marginBottom: 6 }}>
                    {school.name}
                  </p>
                  {lowDomains.map(({ domain, pct }, di) => (
                    <div key={domain.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: domainColour(domain.name, di), flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: '#EA4335' }}>
                        {domain.name} — {pct}%
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews due */}
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1B365D', marginBottom: 14 }}>
            Reviews due
          </h3>
          {reviewsDue === null ? (
            <p style={{ fontSize: '0.82rem', color: '#6B7280' }}>Reviews due — coming soon</p>
          ) : reviewsDue.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#6B7280' }}>No reviews due in the next 30 days.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewsDue.slice(0, 8).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1A202C' }}>
                      {r.provision_name || r.label || 'Unnamed'}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 1 }}>{r.schoolName}</p>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#D4751A', fontWeight: 600, flexShrink: 0 }}>
                    {new Date(r.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Schools view ──────────────────────────────────────────────────────
// TODO: add phase filter when schools.phase column exists
function SchoolsView({ schools, domains, matrix, activePpCount, lastActivity, reviewsDueBySchool, onSchoolClick }) {
  const [sortCol, setSortCol]  = useState('pct')
  const [sortDir, setSortDir]  = useState('desc')
  const [expanded, setExpanded] = useState(null)

  function schoolStats(s) {
    const inPlace = domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.inPlace ?? 0), 0)
    const total   = activePpCount || domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.total ?? 0), 0)
    const pct     = total ? Math.round((inPlace / total) * 100) : null
    return { inPlace, total, pct }
  }

  function getSortVal(s) {
    const { inPlace, total, pct } = schoolStats(s)
    if (sortCol === 'name')    return s.name.toLowerCase()
    if (sortCol === 'pct')     return pct ?? -1
    if (sortCol === 'points')  return inPlace
    if (sortCol === 'reviews') return reviewsDueBySchool?.[s.id] ?? 0
    if (sortCol === 'last')    return lastActivity?.[s.id] ?? ''
    return 0
  }

  const sorted = [...schools].sort((a, b) => {
    const av = getSortVal(a), bv = getSortVal(b)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
  }

  function SortArrow({ col }) {
    if (sortCol !== col) return <span style={{ color: '#cbd5e1', marginLeft: 4 }}>↕</span>
    return <span style={{ color: '#1B365D', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thStyle = {
    padding: '12px 14px', textAlign: 'left',
    fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Schools</h2>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F8FAFC' }}>
                <th style={thStyle} onClick={() => handleSort('name')}>School <SortArrow col="name" /></th>
                <th style={thStyle} onClick={() => handleSort('pct')}>Overall % <SortArrow col="pct" /></th>
                <th style={thStyle} onClick={() => handleSort('points')}>Points evidenced <SortArrow col="points" /></th>
                <th style={thStyle} onClick={() => handleSort('reviews')}>Reviews due <SortArrow col="reviews" /></th>
                <th style={thStyle} onClick={() => handleSort('last')}>Last activity <SortArrow col="last" /></th>
                <th style={{ ...thStyle, cursor: 'default' }}>Domains</th>
                <th style={{ ...thStyle, cursor: 'default' }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, si) => {
                const { inPlace, total, pct } = schoolStats(s)
                const rag = ragColour(pct)
                const isExp = expanded === s.id
                const rdCount = reviewsDueBySchool?.[s.id] ?? 0
                const lastAct = lastActivity?.[s.id]
                  ? new Date(lastActivity[s.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'

                return [
                  <tr key={s.id}
                    style={{ borderBottom: '1px solid #F1F5F9', background: si % 2 === 0 ? '#fff' : '#FAFAFA' }}
                  >
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {pct !== null ? (
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                          fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                          background: rag,
                        }}>{pct}%</span>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569' }}>
                      {inPlace} of {total || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: rdCount > 0 ? '#D4751A' : '#94a3b8', fontWeight: rdCount > 0 ? 600 : 400 }}>
                      {rdCount > 0 ? rdCount : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>
                      {lastAct}
                    </td>
                    {/* Domain chips as 6th column */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {domains.map((d, di) => {
                          const cell = matrix[s.id]?.[d.id]
                          const dpct = cell?.total ? Math.round((cell.inPlace / cell.total) * 100) : null
                          const colour = domainColour(d.name, di)
                          const shortName = d.name.split(/\s+/)[0]
                          return (
                            <span key={d.id} style={{
                              fontSize: '0.7rem', padding: '3px 7px', borderRadius: 20,
                              background: `${colour}18`,
                              color: colour,
                              fontWeight: 600, whiteSpace: 'nowrap',
                              border: `1px solid ${colour}30`,
                            }}>
                              {shortName} {dpct !== null ? `${dpct}%` : '—'}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSchoolClick(s.id, s.name, '')}
                        style={{
                          background: 'none', border: '1.5px solid #1B365D',
                          borderRadius: 6, padding: '5px 12px',
                          fontSize: '0.78rem', fontWeight: 600, color: '#1B365D',
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        View school →
                      </button>
                    </td>
                  </tr>,
                ].flat()
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Domains view ─────────────────────────────────────────────────────
function DomainsView({ domains, subDomains, subDomainMatrix, schools, matrix }) {
  const [selectedId, setSelectedId] = useState(domains[0]?.id ?? null)

  const selectedDomain = domains.find(d => d.id === selectedId)
  const colour = selectedDomain ? domainColour(selectedDomain.name) : '#1B365D'

  // Sub-domains for the selected domain that have at least 1 active provision point
  const visibleSubDomains = subDomains
    .filter(sd => sd.domain_id === selectedId)
    .filter(sd => schools.some(s => (subDomainMatrix[sd.id]?.[s.id]?.total ?? 0) > 0))

  function ragChip(inPlace, total) {
    if (!total) return { bg: '#F3F4F6', text: '#9CA3AF', label: '—' }
    const pct = Math.round((inPlace / total) * 100)
    if (pct >= 70) return { bg: '#DCFCE7', text: '#257A3B', label: `${pct}%` }
    if (pct >= 40) return { bg: '#FEF3C7', text: '#D4751A', label: `${pct}%` }
    return { bg: '#FEE2E2', text: '#EA4335', label: `${pct}%` }
  }

  const thBase = {
    padding: '12px 16px', textAlign: 'left',
    fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '2px solid #E5E7EB', background: '#F8FAFC',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Domains</h2>

      {/* Domain pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {domains.map((d, i) => {
          const c = domainColour(d.name, i)
          const active = d.id === selectedId
          return (
            <button key={d.id} type="button"
              onClick={() => setSelectedId(d.id)}
              style={{
                padding: '7px 16px', borderRadius: 20,
                border: `1.5px solid ${c}`,
                background: active ? c : '#fff',
                color: active ? '#fff' : c,
                fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {d.name}
            </button>
          )
        })}
      </div>

      {/* Sub-domain table */}
      {visibleSubDomains.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#9CA3AF', padding: '24px 0' }}>
          No data available for this domain yet.
        </p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, minWidth: 200 }}>Sub-domain</th>
                  {schools.map(s => {
                    const cell = matrix[s.id]?.[selectedId]
                    const pct  = cell?.total ? Math.round((cell.inPlace / cell.total) * 100) : null
                    return (
                      <th key={s.id} style={{ ...thBase, textAlign: 'center', minWidth: 140 }}>
                        {s.name}
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>
                          {pct !== null ? `${pct}% in this domain` : 'No data'}
                        </span>
                      </th>
                    )
                  })}
                  <th style={{ ...thBase, textAlign: 'center', minWidth: 80 }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {visibleSubDomains.map((sd, i) => {
                  const totalPoints = subDomainMatrix[sd.id]?.[schools[0]?.id]?.total ?? 0
                  return (
                    <tr key={sd.id} style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                      cursor: 'default',
                    }}>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }} />
                          {sd.name}
                        </div>
                      </td>
                      {schools.map(s => {
                        const cell = subDomainMatrix[sd.id]?.[s.id]
                        const { bg, text, label } = ragChip(cell?.inPlace ?? 0, cell?.total ?? 0)
                        return (
                          <td key={s.id} style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                              background: bg, color: text,
                              fontSize: '0.82rem', fontWeight: 700,
                            }}>
                              {label}
                            </span>
                          </td>
                        )
                      })}
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                        {totalPoints}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Categories view ───────────────────────────────────────────────────
// NOTE: 'Internal Process / System' is excluded from the school-level analytics tab
// but is included here — it is valid data for a MAT-level overview.
const CATEGORIES_ORDER = [
  'Named Person',
  'Policy / Published Document',
  'Monitoring & Data',
  'Internal Process / System',
  'Staff Training & CPD',
  'External Partnership',
  'Family & Community Engagement',
  'Direct Provision for Students',
]

function CategoriesView({ schools, ppMeta, ppEntryMap, matrix }) {
  const [expanded, setExpanded] = useState(null)

  function pctChip(inPlace, total) {
    if (!total) return { bg: '#F3F4F6', text: '#9CA3AF', label: '—' }
    const pct = Math.round((inPlace / total) * 100)
    if (pct >= 70) return { bg: '#DCFCE7', text: '#257A3B', label: `${pct}%` }
    if (pct >= 40) return { bg: '#FEF3C7', text: '#D4751A', label: `${pct}%` }
    return { bg: '#FEE2E2', text: '#EA4335', label: `${pct}%` }
  }

  function statusChip(status) {
    if (!status) return { bg: '#F3F4F6', text: '#9CA3AF', label: '—' }
    if (status === 'in_place')    return { bg: '#DCFCE7', text: '#257A3B', label: 'In place' }
    if (status === 'in_progress') return { bg: '#FEF3C7', text: '#D4751A', label: 'In progress' }
    return { bg: '#FEE2E2', text: '#EA4335', label: 'Not in place' }
  }

  // Build category data from ppMeta + ppEntryMap
  const categoryData = CATEGORIES_ORDER.map(cat => {
    const catPPs = ppMeta
      .filter(pp => pp.category === cat)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    if (catPPs.length === 0) return null

    const schoolStats = schools.map(s => {
      const inPlace = catPPs.filter(pp => ppEntryMap[pp.id]?.[s.id] === 'in_place').length
      const total   = catPPs.length
      const pct     = Math.round((inPlace / total) * 100)
      return { schoolId: s.id, schoolName: s.name, inPlace, total, pct }
    })

    const allPcts = schoolStats.map(ss => ss.pct)
    const trustAvg = allPcts.length
      ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length)
      : null

    return {
      category: cat,
      schools: schoolStats,
      trustAvg,
      totalPoints: catPPs.length,
      provisionPoints: catPPs.map(pp => ({
        id: pp.id,
        label: pp.label,
        schools: schools.map(s => ({ schoolId: s.id, status: ppEntryMap[pp.id]?.[s.id] ?? null })),
      })),
    }
  }).filter(Boolean)

  // Banner: categories where any school is below 40%
  const attentionCount = categoryData.filter(cd =>
    cd.schools.some(ss => ss.pct < 40)
  ).length

  const thBase = {
    padding: '12px 16px', textAlign: 'left',
    fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '2px solid #E5E7EB', background: '#F8FAFC',
    whiteSpace: 'nowrap',
  }

  // Per-school overall readiness % for column subheaders
  function overallPct(schoolId) {
    const vals = Object.values(matrix[schoolId] ?? {})
    const inPlace = vals.reduce((s, v) => s + v.inPlace, 0)
    const total   = vals.reduce((s, v) => s + v.total, 0)
    return total ? Math.round((inPlace / total) * 100) : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Categories</h2>

      {/* Summary banner */}
      <div style={{
        background: 'rgba(27,54,93,0.07)', borderRadius: 8,
        padding: '10px 16px', fontSize: '0.82rem', color: '#1B365D', fontWeight: 500,
      }}>
        {attentionCount > 0
          ? `${attentionCount} of ${categoryData.length} categories need attention across the trust`
          : 'All categories are above 40% in at least one school.'
        }
      </div>

      {/* Category table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: 32, padding: '12px 8px 12px 16px' }} />
                <th style={{ ...thBase, minWidth: 220 }}>Category</th>
                {schools.map(s => {
                  const pct = overallPct(s.id)
                  return (
                    <th key={s.id} style={{ ...thBase, textAlign: 'center', minWidth: 150 }}>
                      {s.name}
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>
                        {pct !== null ? `${pct}% overall` : 'No data'}
                      </span>
                    </th>
                  )
                })}
                <th style={{ ...thBase, textAlign: 'center', minWidth: 110 }}>Trust avg</th>
                <th style={{ ...thBase, textAlign: 'center', minWidth: 70 }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((cd, ci) => {
                const isOpen = expanded === cd.category
                return [
                  /* Category row */
                  <tr key={cd.category}
                    onClick={() => setExpanded(isOpen ? null : cd.category)}
                    style={{
                      borderBottom: isOpen ? 'none' : '1px solid #F1F5F9',
                      background: isOpen ? '#F8FAFC' : ci % 2 === 0 ? '#fff' : '#FAFAFA',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '12px 8px 12px 16px', color: '#94a3b8', fontSize: '0.75rem', userSelect: 'none' }}>
                      {isOpen ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '12px 16px 12px 8px', fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                      {cd.category}
                    </td>
                    {cd.schools.map(ss => {
                      const { bg, text, label } = pctChip(ss.inPlace, ss.total)
                      return (
                        <td key={ss.schoolId} style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: bg, color: text, fontSize: '0.82rem', fontWeight: 700 }}>
                            {label}
                          </span>
                        </td>
                      )
                    })}
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#F3F4F6', color: '#475569', fontSize: '0.82rem', fontWeight: 700 }}>
                        {cd.trustAvg !== null ? `${cd.trustAvg}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                      {cd.totalPoints}
                    </td>
                  </tr>,

                  /* Expanded provision point rows */
                  isOpen && cd.provisionPoints.map((pp, pi) => (
                    <tr key={pp.id}
                      style={{
                        borderBottom: pi === cd.provisionPoints.length - 1 ? '2px solid #E5E7EB' : '1px solid #F1F5F9',
                        background: '#F8FAFC',
                        cursor: 'default',
                      }}
                    >
                      <td style={{ padding: '8px 8px 8px 16px' }} />
                      <td style={{ padding: '8px 16px 8px 32px', fontSize: '0.78rem', color: '#475569' }}>
                        {pp.label}
                      </td>
                      {pp.schools.map(ps => {
                        const { bg, text, label } = statusChip(ps.status)
                        return (
                          <td key={ps.schoolId} style={{ padding: '7px 16px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: bg, color: text, fontSize: '0.75rem', fontWeight: 600 }}>
                              {label}
                            </span>
                          </td>
                        )
                      })}
                      <td colSpan={2} />
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Analytics: Provision Depth heat maps ─────────────────────────────
const HEAT_CATEGORIES = [
  'Staff Training & CPD',
  'External Partnership',
  'Family & Community Engagement',
  'Direct Provision for Students',
]

function cellColour(count) {
  if (count === 0) return '#E5E7EB'
  if (count <= 2)  return '#8FB8D8'
  return '#1B365D'
}

function MATProvisionDepth({ schools, domains, matrix, ppMeta, ppEvCountMap }) {
  const sortedSchools = [...schools].sort((a, b) => {
    const aIn = domains.reduce((s, d) => s + (matrix[a.id]?.[d.id]?.inPlace ?? 0), 0)
    const bIn = domains.reduce((s, d) => s + (matrix[b.id]?.[d.id]?.inPlace ?? 0), 0)
    return bIn - aIn
  })
  const [selectedSchoolId, setSelectedSchoolId] = useState(sortedSchools[0]?.id ?? null)
  const [tooltip, setTooltip] = useState(null)

  const domainOrder  = domains.map(d => d.name)
  const domainById   = Object.fromEntries(domains.map(d => [d.id, d]))

  function heatGroupsForCategory(cat) {
    const catPPs = ppMeta
      .filter(pp => pp.category === cat && pp.domain_id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    const byDomain = {}
    catPPs.forEach(pp => {
      const domain = domainById[pp.domain_id]
      if (!domain) return
      const dn = domain.name
      if (!byDomain[dn]) byDomain[dn] = []
      byDomain[dn].push({
        id: pp.id, name: pp.label, domain: dn,
        count: ppEvCountMap[pp.id]?.[selectedSchoolId] ?? 0,
      })
    })
    return domainOrder.filter(d => byDomain[d]).map(d => ({ domain: d, points: byDomain[d] }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {/* School pill toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sortedSchools.map(s => {
          const active = s.id === selectedSchoolId
          return (
            <button key={s.id} type="button"
              onClick={() => setSelectedSchoolId(s.id)}
              style={{
                padding: '7px 16px', borderRadius: 20,
                border: `1.5px solid ${active ? '#1B365D' : '#E2E8F0'}`,
                background: active ? '#1B365D' : '#fff',
                color: active ? '#fff' : '#64748b',
                fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {s.name}
            </button>
          )
        })}
      </div>

      {/* Heat map grids */}
      {HEAT_CATEGORIES.map(cat => {
        const groups     = heatGroupsForCategory(cat)
        const totalPoints = groups.reduce((sum, g) => sum + g.points.length, 0)
        return (
          <div key={cat} style={{
            background: '#fff', border: '1px solid #E2E8F0',
            borderRadius: 16, padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 2 }}>{cat}</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 12 }}>
              {totalPoints} point{totalPoints !== 1 ? 's' : ''}
            </p>
            {groups.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No provision points in this category.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groups.map(g => (
                  <div key={g.domain}>
                    <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {g.domain}
                    </p>
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
                          {pt.count >= 3 && (
                            <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, lineHeight: 1 }}>
                              {pt.count}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

// ── Analytics: Trust Trajectory stacked bar chart ─────────────────────
function TrustTrajectory({ schools, domains, matrix, activePpCount }) {
  const trajectoryData = schools.map(s => ({
    name:           s.name,
    'In place':     domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.inPlace    ?? 0), 0),
    'In progress':  domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.inProgress ?? 0), 0),
    'Not in place': domains.reduce((sum, d) => sum + (matrix[s.id]?.[d.id]?.notInPlace  ?? 0), 0),
  }))

  const totalPossible = activePpCount * schools.length
  const trustInPlace  = trajectoryData.reduce((s, d) => s + d['In place'],    0)
  const trustProgress = trajectoryData.reduce((s, d) => s + d['In progress'], 0)
  const trustNot      = trajectoryData.reduce((s, d) => s + d['Not in place'], 0)

  const statCards = [
    { label: 'In place',     value: trustInPlace,  sub: `of ${totalPossible} possible across the trust`, colour: '#257A3B', bg: '#DCFCE7' },
    { label: 'In progress',  value: trustProgress, sub: 'provision points being worked on',              colour: '#D4751A', bg: '#FEF3C7' },
    { label: 'Not in place', value: trustNot,      sub: 'provision points not yet started',              colour: '#EA4335', bg: '#FEE2E2' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stacked bar chart */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0',
        borderRadius: 16, padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 20 }}>
          Provision status by school
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={trajectoryData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, activePpCount]} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
              formatter={(value, name) => [value, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
            <Bar dataKey="In place"     stackId="a" fill="#257A3B" barSize={80} />
            <Bar dataKey="In progress"  stackId="a" fill="#D4751A" barSize={80} />
            <Bar dataKey="Not in place" stackId="a" fill="#EA4335" barSize={80} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {statCards.map(c => (
          <div key={c.label} style={{
            background: c.bg, border: `1px solid ${c.colour}30`,
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: c.colour, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {c.label}
            </p>
            <p style={{ fontSize: '1.9rem', fontWeight: 800, color: c.colour, lineHeight: 1, marginBottom: 4 }}>
              {c.value}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#475569' }}>{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Analytics view (tabs: Provision Depth | Trust Trajectory) ─────────
function AnalyticsView({ schools, domains, matrix, ppMeta, ppEvCountMap, activePpCount }) {
  const [activeTab, setActiveTab] = useState('depth')

  function tabStyle(id) {
    const active = activeTab === id
    return {
      padding: '9px 20px', border: 'none',
      borderBottom: `2px solid ${active ? '#1B365D' : 'transparent'}`,
      background: 'none',
      color: active ? '#1B365D' : '#64748b',
      fontWeight: active ? 600 : 400,
      fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
      transition: 'color 0.12s',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Analytics</h2>

      {/* Tab row */}
      <div style={{ borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 0 }}>
        <button type="button" onClick={() => setActiveTab('depth')} style={tabStyle('depth')}>
          Provision Depth
        </button>
        <button type="button" onClick={() => setActiveTab('trajectory')} style={tabStyle('trajectory')}>
          Trust Trajectory
        </button>
      </div>

      {activeTab === 'depth' && (
        <MATProvisionDepth
          schools={schools} domains={domains} matrix={matrix}
          ppMeta={ppMeta} ppEvCountMap={ppEvCountMap}
        />
      )}
      {activeTab === 'trajectory' && (
        <TrustTrajectory
          schools={schools} domains={domains} matrix={matrix} activePpCount={activePpCount}
        />
      )}
    </div>
  )
}

// ── MAT Barriers Intelligence view ───────────────────────────────────
function MATBarriersView({ barriers, barrierLinks, schools, ppMeta, entries, domains, subDomains }) {
  const [activeDomain, setActiveDomain] = useState('all')
  const [activeStatus, setActiveStatus] = useState('all')
  const [expandedPP,   setExpandedPP]   = useState(null)
  const [showMoreMap,  setShowMoreMap]   = useState({})
  const [showAllGaps,  setShowAllGaps]   = useState({})

  // ── Lookups ─────────────────────────────────────────────────────────
  const ppIdToLabel      = new Map(ppMeta.map(pp => [pp.id, pp.label]))
  const ppIdToDomainId   = new Map(ppMeta.map(pp => [pp.id, pp.domain_id]))
  const domainIdToName   = new Map(domains.map(d => [d.id, d.name]))
  const subDomainIdToName = new Map(subDomains.map(sd => [sd.id, sd.name]))
  const schoolIdToName   = new Map(schools.map(s => [s.id, s.name]))

  // Domain names in display order (those that have provision points in ppMeta)
  const domainNamesOrdered = domains
    .map(d => d.name)
    .filter(n => {
      const did = domains.find(d => d.name === n)?.id
      return ppMeta.some(pp => pp.domain_id === did)
    })

  // ── Build from barrierLinks ─────────────────────────────────────────
  // barrier_provision_links: { id, barrier_id, entries: { id, provision_point_id, school_id } }
  const barrierToLinkedEntries = new Map()  // barrierId → [{entryId, ppId, schoolId}]
  const entryIdsWithBarrier    = new Set()
  for (const bl of barrierLinks) {
    const entry = bl.entries
    if (!entry) continue
    entryIdsWithBarrier.add(entry.id)
    if (!barrierToLinkedEntries.has(bl.barrier_id)) barrierToLinkedEntries.set(bl.barrier_id, [])
    barrierToLinkedEntries.get(bl.barrier_id).push({
      entryId:  entry.id,
      ppId:     entry.provision_point_id,
      schoolId: entry.school_id,
    })
  }

  // ── Apply domain + status filters to barriers ───────────────────────
  const filteredBarriers = barriers.filter(b => {
    if (activeStatus !== 'all' && b.status !== activeStatus) return false
    if (activeDomain !== 'all' && domainIdToName.get(b.domain_id) !== activeDomain) return false
    return true
  })

  // ── Panel 1 data ────────────────────────────────────────────────────
  // ppId → [{barrier, schoolId, entryId}]
  const ppToBarrierRows = new Map()
  for (const b of filteredBarriers) {
    for (const le of (barrierToLinkedEntries.get(b.id) ?? [])) {
      if (!ppToBarrierRows.has(le.ppId)) ppToBarrierRows.set(le.ppId, [])
      ppToBarrierRows.get(le.ppId).push({ barrier: b, schoolId: le.schoolId, entryId: le.entryId })
    }
  }
  const ppsWithBarriers = [...ppToBarrierRows.keys()]
    .sort((a, b) => (ppIdToLabel.get(a) ?? '').localeCompare(ppIdToLabel.get(b) ?? ''))

  // entry existence by ppId+schoolId for chip logic
  const entryKeySet = new Set(entries.map(e => `${e.provision_point_id}:${e.school_id}`))

  // ── Panel 2 data ────────────────────────────────────────────────────
  // Per school: not_in_place entries with no barrier, grouped by domain
  const schoolGapData = {}  // schoolId → { name, domains: { domainName → [{ ppId, label }] } }
  const schoolHasAnyNIP = {}  // schoolId → bool (any NIP entry passing domain filter)

  for (const e of entries) {
    if (e.status !== 'not_in_place') continue
    if (activeDomain !== 'all') {
      const dName = domainIdToName.get(ppIdToDomainId.get(e.provision_point_id))
      if (dName !== activeDomain) continue
    }
    schoolHasAnyNIP[e.school_id] = true
    if (entryIdsWithBarrier.has(e.id)) continue  // has a barrier — skip for panel 2

    const sId   = e.school_id
    const dName = domainIdToName.get(ppIdToDomainId.get(e.provision_point_id)) ?? 'Unknown domain'
    if (!schoolGapData[sId]) schoolGapData[sId] = { name: schoolIdToName.get(sId) ?? '', domains: {} }
    if (!schoolGapData[sId].domains[dName]) schoolGapData[sId].domains[dName] = []
    schoolGapData[sId].domains[dName].push({ ppId: e.provision_point_id, label: ppIdToLabel.get(e.provision_point_id) ?? '—' })
  }

  // ── Panel 3 data ────────────────────────────────────────────────────
  const patternMap = {}
  for (const b of filteredBarriers) {
    const key = `${b.domain_id}|${b.sub_domain_id ?? ''}`
    if (!patternMap[key]) patternMap[key] = { domain_id: b.domain_id, sub_domain_id: b.sub_domain_id, barriers: [] }
    patternMap[key].barriers.push(b)
  }
  const sharedPatterns = Object.values(patternMap)
    .filter(g => new Set(g.barriers.map(b => b.school_id)).size >= 2)
    .sort((a, b) => b.barriers.length - a.barriers.length)

  // ── Shared styles ───────────────────────────────────────────────────
  function filterPill(active) {
    return {
      padding: '5px 12px', borderRadius: 20,
      border: `1.5px solid ${active ? '#1B365D' : '#E2E8F0'}`,
      background: active ? '#1B365D' : '#fff',
      color: active ? '#fff' : '#64748b',
      fontSize: '0.78rem', fontWeight: active ? 600 : 400,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
    }
  }

  const panelStyle = {
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }
  const panelHeadStyle = {
    padding: '16px 22px', borderBottom: '1px solid #F1F5F9',
    fontSize: '0.95rem', fontWeight: 700, color: '#1B365D', margin: 0,
  }

  // ── Empty state ─────────────────────────────────────────────────────
  if (barriers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Barriers Intelligence</h2>
        <div style={{ ...panelStyle, padding: '36px 28px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
            No barriers have been recorded across the trust yet. As schools identify barriers to learning, the intelligence view will populate here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1B365D', margin: 0 }}>Barriers Intelligence</h2>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button style={filterPill(activeDomain === 'all')} onClick={() => setActiveDomain('all')}>All domains</button>
        {domainNamesOrdered.map(dn => (
          <button key={dn} style={filterPill(activeDomain === dn)} onClick={() => setActiveDomain(dn)}>{dn}</button>
        ))}
        <span style={{ color: '#94a3b8', margin: '0 6px', fontSize: '0.85rem' }}>|</span>
        {[
          { value: 'all',             label: 'All' },
          { value: 'active',          label: 'Active' },
          { value: 'being_addressed', label: 'Being Addressed' },
          { value: 'resolved',        label: 'Resolved' },
        ].map(s => (
          <button key={s.value} style={filterPill(activeStatus === s.value)} onClick={() => setActiveStatus(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Panel 1: Provision Point Barrier Lens ────────────────────── */}
      <div style={panelStyle}>
        <h3 style={panelHeadStyle}>Where barriers have been identified — and how they were addressed</h3>
        {ppsWithBarriers.length === 0 ? (
          <p style={{ padding: '24px 22px', fontSize: '0.85rem', color: '#94a3b8' }}>No barriers match the current filters.</p>
        ) : ppsWithBarriers.map(ppId => {
          const rows   = ppToBarrierRows.get(ppId) ?? []
          const isOpen = expandedPP === ppId
          const label  = ppIdToLabel.get(ppId) ?? ppId

          return (
            <div key={ppId} style={{ borderBottom: '1px solid #F1F5F9' }}>
              {/* Collapsed header row */}
              <div
                onClick={() => setExpandedPP(isOpen ? null : ppId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 22px', cursor: 'pointer',
                  background: isOpen ? '#F8FAFC' : '#fff',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C', flex: 1 }}>{label}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {schools.map(s => {
                    const schoolRows  = rows.filter(r => r.schoolId === s.id)
                    const hasActive   = schoolRows.some(r => r.barrier.status === 'active' || r.barrier.status === 'being_addressed')
                    const hasResolved = schoolRows.some(r => r.barrier.status === 'resolved')
                    const hasEntry    = entryKeySet.has(`${ppId}:${s.id}`)

                    if (!hasEntry && schoolRows.length === 0) return null

                    let bg = '#E5E7EB', color = '#6B7280'
                    if (hasActive)            { bg = '#D4751A'; color = '#fff' }
                    else if (hasResolved)     { bg = '#1B365D'; color = '#fff' }

                    return (
                      <span key={s.id} style={{
                        display: 'inline-block', padding: '2px 9px', borderRadius: 20,
                        background: bg, color, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {s.name}
                      </span>
                    )
                  })}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
              </div>

              {/* Expanded school cards */}
              {isOpen && (
                <div style={{ padding: '8px 22px 16px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {schools.map(s => {
                    const schoolRows = rows.filter(r => r.schoolId === s.id)
                    const hasEntry   = entryKeySet.has(`${ppId}:${s.id}`)
                    if (!hasEntry && schoolRows.length === 0) return null

                    if (schoolRows.length === 0) {
                      return (
                        <p key={s.id} style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                          {s.name} — no barrier recorded for this point.
                        </p>
                      )
                    }

                    return schoolRows.map(({ barrier }, bi) => {
                      const dc = domainColour(domainIdToName.get(barrier.domain_id) ?? '')
                      const { bg, text, label: sLbl } = barrierStatusBadge(barrier.status)
                      const activeGroups = Object.entries(barrier.student_groups ?? {}).filter(([, v]) => v)
                      return (
                        <div key={`${s.id}-${bi}`} style={{
                          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
                          borderLeft: `3px solid ${dc}`, padding: '11px 14px',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1B365D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {s.name}
                            </span>
                            <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, background: bg, color: text, fontSize: '0.7rem', fontWeight: 600 }}>
                              {sLbl}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#1A202C', lineHeight: 1.5 }}>{barrier.description}</p>
                          {barrier.actions && (
                            <div>
                              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>What was done:</p>
                              <p style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{barrier.actions}</p>
                            </div>
                          )}
                          {activeGroups.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {activeGroups.map(([key]) => (
                                <span key={key} style={{ padding: '2px 8px', borderRadius: 12, background: '#F0F2F5', color: '#475569', fontSize: '0.7rem', fontWeight: 500 }}>
                                  {BARRIER_GROUP_LABELS[key] ?? key}
                                </span>
                              ))}
                            </div>
                          )}
                          {(barrier.scale || barrier.source) && (
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {[barrier.scale, barrier.source].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      )
                    })
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Panel 2: Gaps without a named barrier ────────────────────── */}
      <div style={panelStyle}>
        <h3 style={panelHeadStyle}>Provision points not in place — with no barrier identified</h3>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {schools.map(s => {
            if (!schoolHasAnyNIP[s.id]) return null
            const gapData = schoolGapData[s.id]

            if (!gapData) {
              return (
                <div key={s.id}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>{s.name}</p>
                  <p style={{ fontSize: '0.82rem', color: '#257A3B' }}>✓ All gaps have a barrier identified</p>
                </div>
              )
            }

            const allPtsFlat = Object.entries(gapData.domains).flatMap(([dName, pts]) => pts.map(p => ({ dName, ...p })))
            const total      = allPtsFlat.length
            const showAll    = showAllGaps[s.id]
            const displayed  = showAll ? allPtsFlat : allPtsFlat.slice(0, 10)
            const byDomain   = {}
            for (const p of displayed) {
              if (!byDomain[p.dName]) byDomain[p.dName] = []
              byDomain[p.dName].push(p)
            }

            return (
              <div key={s.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C' }}>{s.name}</p>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {total} provision point{total !== 1 ? 's' : ''} not in place with no barrier recorded
                  </p>
                </div>
                {Object.entries(byDomain).map(([dName, pts]) => (
                  <div key={dName} style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {dName}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {pts.map(pt => (
                        <p key={pt.ppId} style={{ fontSize: '0.82rem', color: '#475569', paddingLeft: 8 }}>• {pt.label}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {total > 10 && !showAll && (
                  <button
                    onClick={() => setShowAllGaps(prev => ({ ...prev, [s.id]: true }))}
                    style={{ background: 'none', border: 'none', color: '#1B365D', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                  >
                    Show all {total} →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Panel 3: Shared barrier patterns ─────────────────────────── */}
      <div style={panelStyle}>
        <h3 style={panelHeadStyle}>Barriers appearing across multiple schools</h3>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sharedPatterns.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
              No shared barrier patterns across schools yet. As more schools add barriers, common themes will appear here.
            </p>
          ) : sharedPatterns.map((g, gi) => {
            const dName   = domainIdToName.get(g.domain_id) ?? 'Unknown domain'
            const sdName  = g.sub_domain_id ? (subDomainIdToName.get(g.sub_domain_id) ?? '') : ''
            const dc      = domainColour(dName)
            const groupKey = `${g.domain_id}|${g.sub_domain_id ?? ''}`
            const distinctSchools = new Set(g.barriers.map(b => b.school_id)).size

            return (
              <div key={gi} style={{ border: '1px solid #E5E7EB', borderRadius: 10, borderLeft: `4px solid ${dc}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1A202C' }}>
                    {dName}{sdName ? ` — ${sdName}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {g.barriers.map((b, bi) => {
                    const { bg, text, label: sLbl } = barrierStatusBadge(b.status)
                    const sName     = schoolIdToName.get(b.school_id) ?? 'Unknown'
                    const moreKey   = `${groupKey}-${bi}`
                    const showMore  = showMoreMap[moreKey]

                    return (
                      <div key={bi} style={{
                        padding: '10px 16px',
                        borderBottom: bi < g.barriers.length - 1 ? '1px solid #F1F5F9' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 9px', borderRadius: 20, background: '#F3F4F6', color: '#475569', fontSize: '0.7rem', fontWeight: 600 }}>
                            {sName}
                          </span>
                          <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, background: bg, color: text, fontSize: '0.7rem', fontWeight: 600 }}>
                            {sLbl}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{b.description}</p>
                        {b.actions && (
                          <div>
                            <p style={{
                              fontSize: '0.78rem', color: '#374151', lineHeight: 1.5,
                              ...(showMore ? {} : {
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }),
                            }}>
                              {b.actions}
                            </p>
                            {!showMore && (
                              <button
                                onClick={() => setShowMoreMap(prev => ({ ...prev, [moreKey]: true }))}
                                style={{ background: 'none', border: 'none', color: '#1B365D', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: 2 }}
                              >
                                Show more
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '8px 16px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {distinctSchools} school{distinctSchools !== 1 ? 's' : ''} ha{distinctSchools === 1 ? 's' : 've'} identified barriers in this area
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Stub panel ────────────────────────────────────────────────────────
function StubView({ title }) {
  return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1B365D', marginBottom: '12px' }}>
        {title}
      </h2>
      <p>This view is coming in a future update.</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function MATDashboard({ supabase, matId, onSchoolClick, isDemoMode = false }) {
  const [activeView,          setActiveView]          = useState('home')
  const [schools,             setSchools]             = useState([])
  const [domains,             setDomains]             = useState([])
  const [subDomains,          setSubDomains]          = useState([])
  const [matrix,              setMatrix]              = useState({})
  const [subDomainMatrix,     setSubDomainMatrix]     = useState({})
  const [ppMeta,              setPpMeta]              = useState([])   // { id, category, label, display_order, domain_id }
  const [ppEntryMap,          setPpEntryMap]          = useState({})   // { [ppId]: { [schoolId]: status } }
  const [ppEvCountMap,        setPpEvCountMap]        = useState({})   // { [ppId]: { [schoolId]: evidenceCount } }
  const [matName,             setMatName]             = useState('MAT Dashboard')
  const [activePpCount,       setActivePpCount]       = useState(0)
  const [lastActivity,        setLastActivity]        = useState({})
  const [reviewsDue,          setReviewsDue]          = useState(null)
  const [reviewsDueBySchool,  setReviewsDueBySchool]  = useState({})
  const [loading,             setLoading]             = useState(true)
  const [entries,             setEntries]             = useState([])
  const [barriers,            setBarriers]            = useState([])
  const [barrierLinks,        setBarrierLinks]        = useState([])

  // Mobile sidebar
  const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!matId) return
    let cancelled = false

    async function load() {
      setLoading(true)

      // Step 1: mat name, schools, domains in parallel
      const [matRes, schoolsRes, domainsRes] = await Promise.all([
        supabase.from('mats').select('name').eq('id', matId).single(),
        supabase.from('schools').select('id, name').eq('mat_id', matId).order('name'),
        supabase.from('domains').select('id, name, display_order').order('display_order'),
      ])
      if (cancelled) return

      if (matRes.data?.name) setMatName(matRes.data.name)
      const schoolList   = schoolsRes.data ?? []
      const domainsFull  = domainsRes.data ?? []
      setSchools(schoolList)
      setDomains(domainsFull)

      if (!schoolList.length) { setLoading(false); return }

      const schoolIds = schoolList.map(s => s.id)

      // Step 2: active provision points + sub_domains + all entries (parallel)
      const [ppRes, subDomainsRes, entriesRes] = await Promise.all([
        supabase.from('provision_points')
          .select('id, sub_domain_id, category, label, display_order, sub_domains(domain_id)')
          .eq('active', true)
          .order('display_order'),
        supabase.from('sub_domains')
          .select('id, name, display_order, domain_id')
          .order('display_order'),
        supabase.from('entries')
          .select('id, school_id, provision_point_id, status, updated_at, evidence_entries(id)')
          .in('school_id', schoolIds),
      ])
      if (cancelled) return

      const allPPs      = ppRes.data ?? []
      const allSubDoms  = subDomainsRes.data ?? []
      setActivePpCount(allPPs.length)
      setSubDomains(allSubDoms)

      // Build sub_domain → domain lookup from the direct sub_domains query (avoids nested join access issues)
      const sdToDomain = {}
      for (const sd of allSubDoms) {
        sdToDomain[sd.id] = sd.domain_id
      }

      setPpMeta(allPPs.map(pp => ({ id: pp.id, category: pp.category, label: pp.label, display_order: pp.display_order, domain_id: sdToDomain[pp.sub_domain_id] ?? null })))

      // Build lookup maps from active provision points
      const ppToDomain    = {}   // ppId → domainId
      const ppToSubDomain = {}   // ppId → subDomainId
      const domainActiveCounts = {}
      const sdActiveCounts     = {}   // subDomainId → active pp count
      for (const pp of allPPs) {
        const sdId  = pp.sub_domain_id
        const domId = sdToDomain[sdId]
        if (domId) {
          ppToDomain[pp.id] = domId
          domainActiveCounts[domId] = (domainActiveCounts[domId] ?? 0) + 1
        }
        if (sdId) {
          ppToSubDomain[pp.id] = sdId
          sdActiveCounts[sdId] = (sdActiveCounts[sdId] ?? 0) + 1
        }
      }

      // Build domain matrix: { [schoolId]: { [domainId]: { inPlace, inProgress, notInPlace, total } } }
      const mat    = {}
      const lastUpd = {}
      for (const s of schoolList) {
        mat[s.id] = {}
        for (const d of domainsFull) {
          mat[s.id][d.id] = { inPlace: 0, inProgress: 0, notInPlace: 0, total: domainActiveCounts[d.id] ?? 0 }
        }
      }

      // Build sub-domain matrix: { [subDomainId]: { [schoolId]: { inPlace, total } } }
      const sdMat = {}
      for (const sd of allSubDoms) {
        sdMat[sd.id] = {}
        for (const s of schoolList) {
          sdMat[sd.id][s.id] = { inPlace: 0, total: sdActiveCounts[sd.id] ?? 0 }
        }
      }

      // Build ppEntryMap: { [ppId]: { [schoolId]: status } }
      // Build ppEvCount:  { [ppId]: { [schoolId]: evidenceCount } }
      const ppEntry  = {}
      const ppEvCount = {}

      for (const e of entriesRes.data ?? []) {
        // Domain matrix
        const domId = ppToDomain[e.provision_point_id]
        if (domId && mat[e.school_id]) {
          if (e.status === 'in_place')        mat[e.school_id][domId].inPlace++
          else if (e.status === 'in_progress') mat[e.school_id][domId].inProgress++
          else if (e.status === 'not_in_place') mat[e.school_id][domId].notInPlace++
        }
        // Sub-domain matrix
        const sdId = ppToSubDomain[e.provision_point_id]
        if (sdId && sdMat[sdId]?.[e.school_id] && e.status === 'in_place') {
          sdMat[sdId][e.school_id].inPlace++
        }
        // Per-pp per-school status (for Categories view)
        if (!ppEntry[e.provision_point_id]) ppEntry[e.provision_point_id] = {}
        ppEntry[e.provision_point_id][e.school_id] = e.status
        // Per-pp per-school evidence count (for Analytics Provision Depth)
        if (!ppEvCount[e.provision_point_id]) ppEvCount[e.provision_point_id] = {}
        ppEvCount[e.provision_point_id][e.school_id] = (e.evidence_entries ?? []).length
        // Last activity
        if (!lastUpd[e.school_id] || e.updated_at > lastUpd[e.school_id]) {
          lastUpd[e.school_id] = e.updated_at
        }
      }

      setMatrix(mat)
      setSubDomainMatrix(sdMat)
      setPpEntryMap(ppEntry)
      setPpEvCountMap(ppEvCount)
      setLastActivity(lastUpd)
      setEntries(entriesRes.data ?? [])

      // Step 3: reviews due within 30 days
      try {
        const today      = new Date()
        const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        const todayStr     = today.toISOString().split('T')[0]
        const thirtyStr    = thirtyDays.toISOString().split('T')[0]

        const revRes = await supabase
          .from('evidence_entries')
          .select('provision_name, next_review_due, entries(school_id, provision_points(label))')
          .gte('next_review_due', todayStr)
          .lte('next_review_due', thirtyStr)
          .order('next_review_due')
          .limit(20)

        if (cancelled) return

        if (!revRes.error && revRes.data) {
          // Filter to this MAT's schools only and attach school name
          const schoolMap = Object.fromEntries(schoolList.map(s => [s.id, s.name]))
          const reviews = revRes.data
            .filter(r => r.entries?.school_id && schoolMap[r.entries.school_id])
            .map(r => ({
              provision_name: r.provision_name || r.entries?.provision_points?.label,
              next_review_due: r.next_review_due,
              schoolName: schoolMap[r.entries.school_id],
              schoolId: r.entries.school_id,
            }))

          setReviewsDue(reviews)

          // Count per school for Schools view
          const bySchool = {}
          for (const r of reviews) {
            bySchool[r.schoolId] = (bySchool[r.schoolId] ?? 0) + 1
          }
          setReviewsDueBySchool(bySchool)
        } else {
          // TODO: implement reviews due query if schema relationship differs
          setReviewsDue(null)
        }
      } catch {
        setReviewsDue(null)
      }

      // Step 4: barriers + barrier_provision_links
      const [barriersRes, barrierLinksRes] = await Promise.all([
        supabase
          .from('barriers')
          .select('id, school_id, domain_id, sub_domain_id, description, student_groups, scale, source, status, actions, date_identified, next_review_due')
          .in('school_id', schoolIds),
        supabase
          .from('barrier_provision_links')
          .select('id, barrier_id, entries!inner(id, provision_point_id, school_id)'),
      ])
      if (cancelled) return

      if (!barriersRes.error)     setBarriers(barriersRes.data ?? [])
      if (!barrierLinksRes.error) setBarrierLinks(barrierLinksRes.data ?? [])

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [matId])

  if (loading) return <p className="state-msg">Loading MAT dashboard…</p>

  return (
    <div style={{
      display: 'flex',
      margin: '-28px -32px -80px',
      minHeight: 'calc(100vh - 64px)',
      position: 'relative',
    }}>
      {/* Backdrop — mobile only, when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }}
        />
      )}

      {/* Sidebar — always on desktop; overlay on mobile when open */}
      {(!isMobile || sidebarOpen) && (
        <div style={isMobile ? {
          position: 'absolute', left: 0, top: 0, height: '100%', zIndex: 100, overflowY: 'auto',
        } : {}}>
          <MatSidebar
            activeView={activeView}
            setActiveView={setActiveView}
            matName={matName}
            onNavClick={isMobile ? () => setSidebarOpen(false) : undefined}
          />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 80px', minWidth: 0 }}>
        {/* Hamburger — mobile only */}
        {isMobile && (
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
        {activeView === 'home' && (
          <HomeView
            matName={matName}
            schools={schools}
            domains={domains}
            matrix={matrix}
            activePpCount={activePpCount}
            reviewsDue={reviewsDue}
            onSchoolClick={onSchoolClick}
            isDemoMode={isDemoMode}
            isMobile={isMobile}
          />
        )}
        {activeView === 'schools' && (
          <SchoolsView
            schools={schools}
            domains={domains}
            matrix={matrix}
            activePpCount={activePpCount}
            lastActivity={lastActivity}
            reviewsDueBySchool={reviewsDueBySchool}
            onSchoolClick={onSchoolClick}
          />
        )}
        {activeView === 'domains' && (
          <DomainsView
            domains={domains}
            subDomains={subDomains}
            subDomainMatrix={subDomainMatrix}
            schools={schools}
            matrix={matrix}
          />
        )}
        {activeView === 'categories' && (
          <CategoriesView
            schools={schools}
            ppMeta={ppMeta}
            ppEntryMap={ppEntryMap}
            matrix={matrix}
          />
        )}
        {activeView === 'barriers' && (
          <MATBarriersView
            barriers={barriers}
            barrierLinks={barrierLinks}
            schools={schools}
            ppMeta={ppMeta}
            entries={entries}
            domains={domains}
            subDomains={subDomains}
          />
        )}
        {activeView === 'analytics' && (
          <AnalyticsView
            schools={schools}
            domains={domains}
            matrix={matrix}
            ppMeta={ppMeta}
            ppEvCountMap={ppEvCountMap}
            activePpCount={activePpCount}
          />
        )}
      </div>
    </div>
  )
}
