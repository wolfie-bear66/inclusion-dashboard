import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const FOUNDER_UUID = '9c539de8-0ddf-43d7-974b-e55406966bb3'

const DOMAIN_ORDER = [
  'SEND Support & Needs',
  'Equity & Disadvantage',
  'Attendance & Engagement',
  'Enrichment',
  'Belonging',
  'Wellbeing',
]

function fmtDate(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function coverageColour(pct) {
  if (pct === null || pct === undefined) return '#e5e7eb'
  if (pct === 0) return '#e5e7eb'
  if (pct < 50) return '#fbbf24'
  if (pct < 80) return '#f97316'
  return '#22c55e'
}

export default function AdminView() {
  const [checking, setChecking] = useState(true)
  const [rows, setRows]         = useState([])
  const [domains, setDomains]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id !== FOUNDER_UUID) {
        window.location.replace('/')
        return
      }
      setChecking(false)
      loadData()
    })
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 1. Schools + their mat_id
      const { data: schools, error: schoolsErr } = await supabase
        .from('schools')
        .select('id, name, mat_id')
        .order('name')
      if (schoolsErr) throw schoolsErr

      const schoolIds = schools.map(s => s.id)

      // 2. MAT names
      const matIds = [...new Set(schools.map(s => s.mat_id).filter(Boolean))]
      let matMap = {}
      if (matIds.length) {
        const { data: mats } = await supabase
          .from('mats')
          .select('id, name')
          .in('id', matIds)
        for (const m of mats ?? []) matMap[m.id] = m.name
      }

      // 3. Domains (ordered)
      const { data: domainsRaw } = await supabase
        .from('domains')
        .select('id, name')
      const sortedDomains = (domainsRaw ?? []).sort(
        (a, b) => DOMAIN_ORDER.indexOf(a.name) - DOMAIN_ORDER.indexOf(b.name)
      )
      setDomains(sortedDomains)

      // 4. All evidence_entries via entries (total count, last 30d, last date)
      //    evidence_entries has entry_id → entries has school_id
      const { data: eeRaw } = await supabase
        .from('evidence_entries')
        .select('id, created_at, entry_id, entries!inner(school_id)')
        .in('entries.school_id', schoolIds)

      const eeBySchool = {}
      for (const ee of eeRaw ?? []) {
        const sid = ee.entries?.school_id
        if (!sid) continue
        if (!eeBySchool[sid]) eeBySchool[sid] = []
        eeBySchool[sid].push(ee)
      }

      // 5. Profile counts per school
      const { data: profilesRaw } = await supabase
        .from('profiles')
        .select('id, school_id')
        .in('school_id', schoolIds)
      const profilesBySchool = {}
      for (const p of profilesRaw ?? []) {
        profilesBySchool[p.school_id] = (profilesBySchool[p.school_id] ?? 0) + 1
      }

      // 6. Active provision point count (global total)
      const { data: ppRaw } = await supabase
        .from('provision_points')
        .select('id, sub_domain_id, sub_domains(domain_id)')
        .eq('active', true)
      const activePpIds = new Set((ppRaw ?? []).map(p => p.id))
      const activePpTotal = activePpIds.size

      // Build pp → domain lookup
      const ppToDomain = {}
      for (const pp of ppRaw ?? []) {
        const domainId = pp.sub_domains?.domain_id
        if (domainId) ppToDomain[pp.id] = domainId
      }

      // 7. Point assignments per school
      const { data: assignRaw } = await supabase
        .from('point_assignments')
        .select('school_id, provision_point_id')
        .in('school_id', schoolIds)
      const assignedBySchool = {}
      for (const a of assignRaw ?? []) {
        if (!assignedBySchool[a.school_id]) assignedBySchool[a.school_id] = new Set()
        assignedBySchool[a.school_id].add(a.provision_point_id)
      }

      // 8. Entries with status per school (for domain coverage)
      const { data: entriesRaw } = await supabase
        .from('entries')
        .select('school_id, provision_point_id, status')
        .in('school_id', schoolIds)
        .in('status', ['in_place', 'in_progress', 'not_in_place'])

      const entriesBySchool = {}
      for (const e of entriesRaw ?? []) {
        if (!entriesBySchool[e.school_id]) entriesBySchool[e.school_id] = []
        entriesBySchool[e.school_id].push(e)
      }

      // Assemble rows
      const assembled = schools.map(school => {
        const sid = school.id

        const ees = eeBySchool[sid] ?? []
        const totalEE = ees.length
        const last30EE = ees.filter(e => e.created_at >= thirtyDaysAgo).length
        const lastDate = ees.length
          ? ees.reduce((max, e) => e.created_at > max ? e.created_at : max, ees[0].created_at)
          : null

        const teamCount = profilesBySchool[sid] ?? 0
        const assignedPps = assignedBySchool[sid] ?? new Set()
        const unassigned = activePpTotal - assignedPps.size

        // Domain coverage: per domain, % of active pp that are in_place
        const schoolEntries = entriesBySchool[sid] ?? []
        const domainCoverage = {}
        for (const domain of sortedDomains) {
          const activePpsInDomain = (ppRaw ?? []).filter(
            pp => ppToDomain[pp.id] === domain.id
          )
          if (!activePpsInDomain.length) { domainCoverage[domain.id] = null; continue }
          const inPlaceCount = activePpsInDomain.filter(pp =>
            schoolEntries.some(e => e.provision_point_id === pp.id && e.status === 'in_place')
          ).length
          domainCoverage[domain.id] = Math.round((inPlaceCount / activePpsInDomain.length) * 100)
        }

        return {
          id: sid,
          name: school.name,
          mat: school.mat_id ? (matMap[school.mat_id] ?? '—') : '—',
          totalEE,
          last30EE,
          lastDate,
          teamCount,
          unassigned,
          domainCoverage,
        }
      })

      setRows(assembled)
    } catch (err) {
      setError(err.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
          ← Back to site
        </a>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1B365D' }}>Founder Admin</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>Internal use only</p>
        <a href="/admin/onboard-school" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'underline', display: 'inline-block', marginTop: 12 }}>
          + Onboard a new school
        </a>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}
      {error && <p style={{ color: '#EA4335' }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#1B365D', color: '#fff' }}>
                <Th>School</Th>
                <Th>MAT</Th>
                <Th>Evidence entries</Th>
                <Th>Last 30 days</Th>
                <Th>Last entry</Th>
                <Th>Team members</Th>
                <Th>Unassigned pts</Th>
                {domains.map(d => (
                  <Th key={d.id} style={{ minWidth: 64, textAlign: 'center' }}>
                    {d.name.split(' ')[0]}
                  </Th>
                ))}
                <Th>Reports</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <Td style={{ fontWeight: 600, color: '#1B365D' }}>{row.name}</Td>
                  <Td>{row.mat}</Td>
                  <Td>{row.totalEE}</Td>
                  <Td>{row.last30EE}</Td>
                  <Td>{fmtDate(row.lastDate)}</Td>
                  <Td>{row.teamCount}</Td>
                  <Td>{row.unassigned}</Td>
                  {domains.map(d => {
                    const pct = row.domainCoverage[d.id]
                    const bg = coverageColour(pct)
                    return (
                      <Td key={d.id} style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <span style={{
                          display: 'inline-block',
                          minWidth: 36,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: bg,
                          color: pct >= 50 ? '#fff' : '#1e293b',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}>
                          {pct === null ? '—' : `${pct}%`}
                        </span>
                      </Td>
                    )
                  })}
                  <Td style={{ color: '#94a3b8' }}>n/a</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8 + domains.length} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                    No schools found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, style }) {
  return (
    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', ...style }}>
      {children}
    </th>
  )
}

function Td({ children, style }) {
  return (
    <td style={{ padding: '10px 12px', borderTop: '1px solid #E2E8F0', color: '#334155', ...style }}>
      {children}
    </td>
  )
}
