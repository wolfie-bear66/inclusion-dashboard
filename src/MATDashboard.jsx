import { useEffect, useState } from 'react'

const DOMAIN_COLOUR_MAP = [
  { key: 'SEND',       colour: '#6366f1' },
  { key: 'Equity',     colour: '#f59e0b' },
  { key: 'Attendance', colour: '#ec4899' },
  { key: 'Enrichment', colour: '#14b8a6' },
  { key: 'Belonging',  colour: '#f97316' },
  { key: 'Wellbeing',  colour: '#84cc16' },
]
function domainColour(name = '') {
  return DOMAIN_COLOUR_MAP.find(d => name.includes(d.key))?.colour ?? '#94a3b8'
}

function cellStyle(inPlace, total) {
  if (!total) return { bg: '#f8fafc', text: '#94a3b8' }
  const pct = (inPlace / total) * 100
  if (pct >= 75) return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' }
  if (pct >= 40) return { bg: '#fef9c3', text: '#d97706', border: '#fde68a' }
  return { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' }
}

export default function MATDashboard({ supabase, matId, onSchoolClick }) {
  const [schools,    setSchools]    = useState([])
  const [domains,    setDomains]    = useState([])
  const [matrix,     setMatrix]     = useState({})  // { [schoolId]: { [domainId]: { inPlace, total } } }
  const [lastSaved,  setLastSaved]  = useState({})  // { [schoolId]: ISO string }
  const [matName,    setMatName]    = useState('MAT Dashboard')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!matId) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [matRes, schoolsRes, domainsRes] = await Promise.all([
        supabase.from('mats').select('name').eq('id', matId).single(),
        supabase.from('schools').select('id, name').eq('mat_id', matId).order('name'),
        supabase.from('domains')
          .select('id, name, display_order, sub_domains(provision_points(id))')
          .order('display_order'),
      ])

      if (cancelled) return

      if (matRes.data?.name) setMatName(matRes.data.name)

      const schoolList  = schoolsRes.data ?? []
      const domainsFull = domainsRes.data ?? []

      // Build ppId → domainId map and per-domain totals
      const ppToDomain = {}
      const domainTotals = {}
      for (const d of domainsFull) {
        let count = 0
        for (const sd of d.sub_domains ?? []) {
          for (const pp of sd.provision_points ?? []) {
            ppToDomain[pp.id] = d.id
            count++
          }
        }
        domainTotals[d.id] = count
      }

      const cleanDomains = domainsFull.map(({ sub_domains: _, ...d }) => d)
      setDomains(cleanDomains)
      setSchools(schoolList)

      if (!schoolList.length) { setLoading(false); return }

      // Load entries for all MAT schools in one query
      const schoolIds = schoolList.map(s => s.id)
      const [entriesRes, latestRes] = await Promise.all([
        supabase
          .from('entries')
          .select('school_id, provision_point_id, status')
          .in('school_id', schoolIds),
        supabase
          .from('entries')
          .select('school_id, created_at')
          .in('school_id', schoolIds)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return

      // Seed matrix with zeroes
      const mat = {}
      const lastUpd = {}
      for (const s of schoolList) {
        mat[s.id] = {}
        for (const d of cleanDomains) {
          mat[s.id][d.id] = { inPlace: 0, total: domainTotals[d.id] ?? 0 }
        }
      }

      for (const e of entriesRes.data ?? []) {
        const domId = ppToDomain[e.provision_point_id]
        if (!domId || !mat[e.school_id]) continue
        if (e.status === 'in_place') mat[e.school_id][domId].inPlace++
      }

      // Latest update per school (most recent entry created_at)
      for (const e of latestRes.data ?? []) {
        if (!lastUpd[e.school_id]) lastUpd[e.school_id] = e.created_at
      }

      setMatrix(mat)
      setLastSaved(lastUpd)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [matId])

  // Domains where the gap between schools is ≥ 25 percentage points
  const divergentDomains = schools.length >= 2
    ? domains.filter(d => {
        const pcts = schools.map(s => {
          const c = matrix[s.id]?.[d.id]
          return c?.total ? (c.inPlace / c.total) * 100 : null
        }).filter(p => p !== null)
        return pcts.length >= 2 && (Math.max(...pcts) - Math.min(...pcts)) >= 25
      })
    : []

  if (loading) return <p className="state-msg">Loading MAT dashboard…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* MAT header card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Multi-Academy Trust</p>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{matName}</h2>
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{schools.length} school{schools.length !== 1 ? 's' : ''} · {domains.length} domains</p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {schools.map(s => (
            <div key={s.id} style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e293b' }}>{s.name}</p>
              {lastSaved[s.id] && (
                <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                  Last activity: {new Date(lastSaved[s.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {!lastSaved[s.id] && (
                <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>No data recorded yet</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Divergence alert */}
      {divergentDomains.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
            ⚠ Significant divergence between schools in {divergentDomains.length} domain{divergentDomains.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {divergentDomains.map(d => {
              const schoolPcts = schools.map(s => {
                const c = matrix[s.id]?.[d.id]
                const pct = c?.total ? Math.round((c.inPlace / c.total) * 100) : null
                return `${s.name}: ${pct !== null ? pct + '%' : '—'}`
              })
              return (
                <p key={d.id} style={{ fontSize: '0.78rem', color: '#78350f' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: domainColour(d.name), marginRight: 6, verticalAlign: 'middle' }} />
                  {d.name} — {schoolPcts.join(' vs ')}
                </p>
              )
            })}
          </div>
        </div>
      )}

      {/* Matrix table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '35%' }}>
                Domain
              </th>
              {schools.map(s => (
                <th key={s.id} style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                  <button
                    type="button"
                    onClick={() => onSchoolClick(s.id, s.name, '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    {s.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {domains.map((d, i) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: domainColour(d.name), flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>{d.name}</span>
                    {divergentDomains.some(dd => dd.id === d.id) && (
                      <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600, marginLeft: 4 }}>divergent</span>
                    )}
                  </div>
                </td>
                {schools.map(s => {
                  const cell  = matrix[s.id]?.[d.id] ?? { inPlace: 0, total: 0 }
                  const pct   = cell.total ? Math.round((cell.inPlace / cell.total) * 100) : null
                  const style = cellStyle(cell.inPlace, cell.total)
                  return (
                    <td key={s.id} style={{ padding: '8px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onSchoolClick(s.id, s.name, d.id)}
                        title={cell.total ? `${cell.inPlace} of ${cell.total} in place — click to view` : 'No data yet'}
                        style={{
                          background:   style.bg,
                          color:        style.text,
                          border:       `1.5px solid ${style.border ?? '#e2e8f0'}`,
                          borderRadius: 8,
                          padding:      '7px 18px',
                          cursor:       'pointer',
                          fontSize:     '0.88rem',
                          fontWeight:   700,
                          minWidth:     80,
                          transition:   'opacity 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        {pct !== null ? `${pct}%` : '—'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingLeft: 4 }}>
        {[
          { bg: '#dcfce7', border: '#bbf7d0', text: '#16a34a', label: '75%+ in place' },
          { bg: '#fef9c3', border: '#fde68a', text: '#d97706', label: '40–74% in place' },
          { bg: '#fee2e2', border: '#fecaca', text: '#dc2626', label: 'Below 40%' },
          { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', label: 'No data' },
        ].map(({ bg, border, text, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: bg, border: `1.5px solid ${border}`, display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
