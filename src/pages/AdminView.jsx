import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const STATS_URL = `${SUPABASE_URL}/functions/v1/admin-dashboard-stats`
const RESEND_URL = `${SUPABASE_URL}/functions/v1/resend-invite`
const UPDATE_SCHOOL_URL = `${SUPABASE_URL}/functions/v1/update-school`
const UPDATE_ROLE_URL = `${SUPABASE_URL}/functions/v1/update-user-role`
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const STATUS_LABEL = { trial: 'Trial', paid: 'Paid', churned: 'Churned' }
const STATUS_COLOUR = { trial: '#D4751A', paid: '#22c55e', churned: '#94a3b8' }
const STATUS_ORDER = { trial: 0, paid: 1, churned: 2 }
const ENGAGEMENT_LABEL = { active: 'Active', stalled: 'Stalled', never_logged_in: 'Never logged in' }
const ENGAGEMENT_COLOUR = { active: '#22c55e', stalled: '#f97316', never_logged_in: '#94a3b8' }
const ENGAGEMENT_ORDER = { active: 0, stalled: 1, never_logged_in: 2 }
const LOGIN_STATUS_LABEL = { logged_in: 'Logged in', opened_no_password: 'Invite opened, no login set', never_opened: 'Never opened invite' }
const LOGIN_STATUS_COLOUR = { logged_in: '#22c55e', opened_no_password: '#f97316', never_opened: '#94a3b8' }
const LOGIN_STATUS_ORDER = { logged_in: 0, opened_no_password: 1, never_opened: 2 }

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function fmtDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0)
}

function approversFor(row) {
  return (row.staff ?? []).filter(p => p.role === 'approver')
}

function firstApproverName(row) {
  const a = approversFor(row)[0]
  return a ? `${a.first_name} ${a.last_name}` : null
}

// One getter per sortable column. `type` drives how two values compare;
// nulls/empties always sort last regardless of direction, rather than
// jumping to whichever end asc/desc happens to put them on.
const SORT_CONFIG = {
  name: { type: 'text', get: r => r.name },
  status: { type: 'rank', get: r => STATUS_ORDER[r.subscription_status] ?? 99 },
  price: { type: 'number', get: r => (r.annual_price != null ? Number(r.annual_price) : null) },
  confirmed: { type: 'date', get: r => r.confirmed_at },
  staff: { type: 'number', get: r => r.staff_count },
  approver: { type: 'text', get: r => firstApproverName(r) },
  started: { type: 'number', get: r => r.started_count },
  engagement: { type: 'rank', get: r => ENGAGEMENT_ORDER[r.engagement_status] ?? 99 },
  login_status: { type: 'rank', get: r => LOGIN_STATUS_ORDER[r.login_status] ?? 99 },
  last_login: { type: 'date', get: r => r.last_login },
}

function isEmpty(v) {
  return v === null || v === undefined || v === ''
}

function compareBy(key, a, b, dir) {
  const cfg = SORT_CONFIG[key]
  const av = cfg.get(a)
  const bv = cfg.get(b)
  if (isEmpty(av) && isEmpty(bv)) return 0
  if (isEmpty(av)) return 1
  if (isEmpty(bv)) return -1
  let cmp
  if (cfg.type === 'text') cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
  else if (cfg.type === 'date') cmp = new Date(av).getTime() - new Date(bv).getTime()
  else cmp = av - bv
  return dir === 'asc' ? cmp : -cmp
}

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => compareBy(key, a, b, dir))
}

function emptyFilters() {
  return {
    status: new Set(),
    confirmed: new Set(),
    engagement: new Set(),
    staffMin: '',
    staffMax: '',
    startedMin: '',
    startedMax: '',
    lastLogin: 'all',
  }
}

function filtersActive(filters) {
  return filters.status.size > 0 || filters.confirmed.size > 0 || filters.engagement.size > 0
    || filters.staffMin !== '' || filters.staffMax !== ''
    || filters.startedMin !== '' || filters.startedMax !== ''
    || filters.lastLogin !== 'all'
}

function filterRows(rows, filters) {
  return rows.filter(row => {
    if (filters.status.size && !filters.status.has(row.subscription_status)) return false
    if (filters.confirmed.size) {
      const bucket = row.confirmed_at ? 'yes' : 'never'
      if (!filters.confirmed.has(bucket)) return false
    }
    if (filters.engagement.size && !filters.engagement.has(row.engagement_status)) return false
    if (filters.staffMin !== '' && row.staff_count < Number(filters.staffMin)) return false
    if (filters.staffMax !== '' && row.staff_count > Number(filters.staffMax)) return false
    if (filters.startedMin !== '' && row.started_count < Number(filters.startedMin)) return false
    if (filters.startedMax !== '' && row.started_count > Number(filters.startedMax)) return false
    if (filters.lastLogin === 'last30') {
      if (!row.last_login || Date.now() - new Date(row.last_login).getTime() > THIRTY_DAYS_MS) return false
    } else if (filters.lastLogin === 'never') {
      if (row.last_login) return false
    }
    return true
  })
}

export default function AdminView() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingRow, setEditingRow] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)
  const [resendingId, setResendingId] = useState(null)
  const [resendMsgByRow, setResendMsgByRow] = useState({})
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filters, setFilters] = useState(emptyFilters)

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleSetFilter(field, value) {
    setFilters(prev => {
      const next = new Set(prev[field])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [field]: next }
    })
  }

  const rows = data?.rows ?? []
  const statusValues = [...new Set(rows.map(r => r.subscription_status))]
    .sort((a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99))
  const engagementValues = [...new Set(rows.map(r => r.engagement_status))]
    .sort((a, b) => (ENGAGEMENT_ORDER[a] ?? 99) - (ENGAGEMENT_ORDER[b] ?? 99))
  const visibleRows = sortRows(filterRows(rows, filters), sortKey, sortDir)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.replace('/'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_founder')
        .eq('id', session.user.id)
        .single()
      if (!profile?.is_founder) { window.location.replace('/'); return }
      setAllowed(true)
      setChecking(false)
      loadData()
    })
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(STATS_URL, {
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': PUBLISHABLE_KEY },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load dashboard data')
      setData(json)
    } catch (err) {
      setError(err.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendInvite(profileId) {
    setActionMsg(null)
    setResendMsgByRow(prev => ({ ...prev, [profileId]: null }))
    setResendingId(profileId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ profile_id: profileId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to resend invite')
      // Resending always reissues the temporary password, so any earlier invite email in the
      // recipient's inbox now holds a password that no longer works. Worth surfacing, since
      // an older email still sitting there is exactly what produced Jenny Carson's
      // dead-end report.
      const text = `Invite resent to ${json.email}. Note: any previous invite email sent to this address is now invalid — only the password in the most recent email will work.`
      setActionMsg({ type: 'success', text })
      setResendMsgByRow(prev => ({ ...prev, [profileId]: { type: 'success', text: `Resent to ${json.email}` } }))
      // Refetch so the row's "Invite sent" date reflects this resend straight away.
      loadData()
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
      setResendMsgByRow(prev => ({ ...prev, [profileId]: { type: 'error', text: err.message } }))
    } finally {
      setResendingId(null)
    }
  }

  async function handleSaveEdit(edited) {
    setActionMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(UPDATE_SCHOOL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify(edited),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update school')
      setActionMsg({ type: 'success', text: 'School updated.' })
      setEditingRow(null)
      loadData()
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    }
  }

  async function handleChangeRole(profileId, role) {
    setActionMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(UPDATE_ROLE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ profile_id: profileId, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update role')
      setActionMsg({ type: 'success', text: 'Role updated.' })
      loadData()
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    }
  }

  if (checking || !allowed) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <a href="/mat-dashboard" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
            ← Back to site
          </a>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1B365D' }}>Founder Admin</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>Internal use only</p>
          <a href="/admin/onboard-school" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'underline', display: 'inline-block', marginTop: 12 }}>
            + Onboard a new school
          </a>
        </div>
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); window.location.replace('/') }}
          style={actionBtnStyle}
        >
          Sign out
        </button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}
      {error && <p style={{ color: '#EA4335' }}>Error: {error}</p>}

      {actionMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.8125rem',
          background: actionMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          color: actionMsg.type === 'error' ? '#B91C1C' : '#166534',
        }}>
          {actionMsg.text}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <Tile title="Pipeline">
              <StatRow label="Trial" value={data.pipeline.trial} colour={STATUS_COLOUR.trial} />
              <StatRow label="Paid" value={data.pipeline.paid} colour={STATUS_COLOUR.paid} />
              <StatRow label="Churned" value={data.pipeline.churned} colour={STATUS_COLOUR.churned} />
            </Tile>
            <Tile title="Engagement">
              <StatRow label="Active (30d)" value={data.engagement.active_last_30} colour={ENGAGEMENT_COLOUR.active} />
              <StatRow label="Stalled" value={data.engagement.stalled} colour={ENGAGEMENT_COLOUR.stalled} />
              <StatRow label="Never logged in" value={data.engagement.never_logged_in} colour={ENGAGEMENT_COLOUR.never_logged_in} />
            </Tile>
            <Tile title="Revenue">
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1B365D' }}>{fmtMoney(data.revenue.annual_total)}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                annual, across {data.revenue.paid_school_count} paid school{data.revenue.paid_school_count === 1 ? '' : 's'}
              </div>
            </Tile>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Filters
              </span>
              <button
                type="button"
                onClick={() => setFilters(emptyFilters())}
                disabled={!filtersActive(filters)}
                style={{ ...actionBtnStyle, opacity: filtersActive(filters) ? 1 : 0.5, cursor: filtersActive(filters) ? 'pointer' : 'default' }}
              >
                Clear filters
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <FilterGroup label="Status">
                {statusValues.map(v => (
                  <FilterChip key={v} active={filters.status.has(v)} onClick={() => toggleSetFilter('status', v)}>
                    {STATUS_LABEL[v] ?? v}
                  </FilterChip>
                ))}
              </FilterGroup>

              <FilterGroup label="Confirmed">
                <FilterChip active={filters.confirmed.has('yes')} onClick={() => toggleSetFilter('confirmed', 'yes')}>Yes</FilterChip>
                <FilterChip active={filters.confirmed.has('never')} onClick={() => toggleSetFilter('confirmed', 'never')}>Never</FilterChip>
              </FilterGroup>

              <FilterGroup label="Engagement">
                {engagementValues.map(v => (
                  <FilterChip key={v} active={filters.engagement.has(v)} onClick={() => toggleSetFilter('engagement', v)}>
                    {ENGAGEMENT_LABEL[v] ?? v}
                  </FilterChip>
                ))}
              </FilterGroup>

              <FilterGroup label="Staff">
                <input type="number" min="0" placeholder="Min" value={filters.staffMin}
                  onChange={e => setFilters(prev => ({ ...prev, staffMin: e.target.value }))}
                  style={{ ...inputStyle, width: 64, padding: '4px 8px' }} />
                <span style={{ color: '#94a3b8' }}>–</span>
                <input type="number" min="0" placeholder="Max" value={filters.staffMax}
                  onChange={e => setFilters(prev => ({ ...prev, staffMax: e.target.value }))}
                  style={{ ...inputStyle, width: 64, padding: '4px 8px' }} />
              </FilterGroup>

              <FilterGroup label="Started">
                <input type="number" min="0" placeholder="Min" value={filters.startedMin}
                  onChange={e => setFilters(prev => ({ ...prev, startedMin: e.target.value }))}
                  style={{ ...inputStyle, width: 64, padding: '4px 8px' }} />
                <span style={{ color: '#94a3b8' }}>–</span>
                <input type="number" min="0" placeholder="Max" value={filters.startedMax}
                  onChange={e => setFilters(prev => ({ ...prev, startedMax: e.target.value }))}
                  style={{ ...inputStyle, width: 64, padding: '4px 8px' }} />
              </FilterGroup>

              <FilterGroup label="Last login">
                <select value={filters.lastLogin} onChange={e => setFilters(prev => ({ ...prev, lastLogin: e.target.value }))} style={{ ...inputStyle, padding: '4px 8px' }}>
                  <option value="all">All</option>
                  <option value="last30">Within last 30 days</option>
                  <option value="never">Never logged in</option>
                </select>
              </FilterGroup>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#1B365D', color: '#fff' }}>
                  <Th sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort}>School</Th>
                  <Th sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Status</Th>
                  <Th sortKey="price" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Price</Th>
                  <Th sortKey="confirmed" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Confirmed</Th>
                  <Th sortKey="staff" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Staff</Th>
                  <Th sortKey="approver" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Approver</Th>
                  <Th sortKey="started" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Started</Th>
                  <Th sortKey="engagement" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Engagement</Th>
                  <Th sortKey="login_status" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Login status</Th>
                  <Th sortKey="last_login" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Last login</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <Td style={{ fontWeight: 600, color: '#1B365D' }}>{row.name}</Td>
                    <Td><Pill colour={STATUS_COLOUR[row.subscription_status]}>{STATUS_LABEL[row.subscription_status]}</Pill></Td>
                    <Td>{row.annual_price ? fmtMoney(row.annual_price) : (row.price_tier ?? '—')}</Td>
                    <Td>{fmtDate(row.confirmed_at)}</Td>
                    <Td>{row.staff_count}</Td>
                    <Td><ApproverCell approvers={approversFor(row)} /></Td>
                    <Td>{row.started_count}/{data.active_point_total}</Td>
                    <Td><Pill colour={ENGAGEMENT_COLOUR[row.engagement_status]}>{ENGAGEMENT_LABEL[row.engagement_status]}</Pill></Td>
                    <Td>
                      {row.login_status ? <Pill colour={LOGIN_STATUS_COLOUR[row.login_status]}>{LOGIN_STATUS_LABEL[row.login_status]}</Pill> : '—'}
                      <div style={{ marginTop: 4, fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        Invite sent {row.last_invite_sent ? fmtDate(row.last_invite_sent) : '—'}
                      </div>
                    </Td>
                    <Td>{fmtDate(row.last_login)}</Td>
                    <Td>
                      <button onClick={() => setEditingRow(row)} style={actionBtnStyle}>Edit</button>
                      {row.pending_invites.map(p => (
                        <span key={p.profile_id} style={{ display: 'inline-block' }}>
                          <button
                            onClick={() => handleResendInvite(p.profile_id)}
                            title={p.email ?? ''}
                            disabled={resendingId === p.profile_id}
                            style={{
                              ...actionBtnStyle, marginLeft: 6,
                              opacity: resendingId === p.profile_id ? 0.6 : 1,
                              cursor: resendingId === p.profile_id ? 'default' : 'pointer',
                            }}
                          >
                            {resendingId === p.profile_id
                              ? 'Resending…'
                              : `Resend${row.pending_invites.length > 1 ? ` (${p.email?.split('@')[0] ?? '?'})` : ' invite'}`}
                          </button>
                          {resendMsgByRow[p.profile_id] && (
                            <div style={{
                              marginTop: 4, fontSize: '0.6875rem', maxWidth: 220,
                              color: resendMsgByRow[p.profile_id].type === 'error' ? '#B91C1C' : '#166534',
                            }}>
                              {resendMsgByRow[p.profile_id].text}
                            </div>
                          )}
                        </span>
                      ))}
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No schools found.</td></tr>
                )}
                {rows.length > 0 && visibleRows.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No schools match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingRow && (
        <EditSchoolModal
          row={editingRow}
          mats={data?.mats ?? []}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveEdit}
          onChangeRole={handleChangeRole}
        />
      )}
    </div>
  )
}

function EditSchoolModal({ row, mats, onClose, onSave, onChangeRole }) {
  const [name, setName] = useState(row.name)
  const [status, setStatus] = useState(row.subscription_status)
  const [priceTier, setPriceTier] = useState(row.price_tier ?? '')
  const [annualPrice, setAnnualPrice] = useState(row.annual_price ?? '')
  const [matChoice, setMatChoice] = useState(row.mat_id ?? '__standalone__')
  const [newMatName, setNewMatName] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const matPayload = matChoice === '__new__'
      ? { new_mat_name: newMatName }
      : { mat_id: matChoice === '__standalone__' ? null : matChoice }
    await onSave({
      school_id: row.id,
      name,
      subscription_status: status,
      price_tier: priceTier || null,
      annual_price: annualPrice === '' ? null : Number(annualPrice),
      ...matPayload,
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, overflowY: 'auto', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#1B365D' }}>Edit {row.name}</h2>

        <Field label="School name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Subscription status">
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            <option value="trial">Trial</option>
            <option value="paid">Paid</option>
            <option value="churned">Churned</option>
          </select>
        </Field>
        <Field label="Price tier (label)">
          <input value={priceTier} onChange={e => setPriceTier(e.target.value)} placeholder="e.g. Band 1 (£500)" style={inputStyle} />
        </Field>
        <Field label="Annual price (£, used for revenue total)">
          <input type="number" value={annualPrice} onChange={e => setAnnualPrice(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="MAT">
          <select value={matChoice} onChange={e => setMatChoice(e.target.value)} style={inputStyle}>
            <option value="__standalone__">Standalone school (no MAT)</option>
            {mats.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="__new__">+ Create new MAT…</option>
          </select>
        </Field>
        {matChoice === '__new__' && (
          <Field label="New MAT name">
            <input value={newMatName} onChange={e => setNewMatName(e.target.value)} style={inputStyle} />
          </Field>
        )}

        {row.staff.length > 0 && (
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
              Staff & roles
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {row.staff.map(person => (
                <div key={person.profile_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
                    {person.first_name} {person.last_name}
                    {person.job_title ? <span style={{ color: '#94a3b8' }}> — {person.job_title}</span> : null}
                  </div>
                  <select
                    value={person.role}
                    onChange={e => onChangeRole(person.profile_id, e.target.value)}
                    style={{ ...inputStyle, padding: '4px 8px', width: 140 }}
                  >
                    <option value="contributor">Contributor</option>
                    <option value="approver">Approver</option>
                    <option value="mat_admin">MAT Admin</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ ...actionBtnStyle, background: '#fff' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...actionBtnStyle, background: '#1B365D', color: '#fff' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function StatRow({ label, value, colour }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: '0.8125rem', color: '#334155' }}>{label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: colour }}>{value}</span>
    </div>
  )
}

function ApproverCell({ approvers }) {
  if (approvers.length === 0) return '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {approvers.map(a => (
        <div key={a.profile_id}>
          <div>{a.first_name} {a.last_name}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{a.email ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

function Pill({ children, colour }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      background: `${colour}1A`, color: colour, fontWeight: 600, fontSize: '0.75rem',
    }}>
      {children}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem', color: '#334155' }}>
      {label}
      {children}
    </label>
  )
}

function Th({ children, sortKey, activeKey, dir, onSort }) {
  const isActive = sortKey && activeKey === sortKey
  return (
    <th
      onClick={sortKey ? () => onSort(sortKey) : undefined}
      style={{
        padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap',
        cursor: sortKey ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      {children}
      {sortKey && (
        <span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.4 }}>
          {isActive ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      )}
    </th>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...actionBtnStyle, ...(active ? chipActiveStyle : {}) }}
    >
      {children}
    </button>
  )
}

function Td({ children, style }) {
  return <td style={{ padding: '10px 12px', borderTop: '1px solid #E2E8F0', color: '#334155', ...style }}>{children}</td>
}

const inputStyle = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.8125rem', fontFamily: 'inherit',
}

const actionBtnStyle = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff',
  fontSize: '0.75rem', fontWeight: 600, color: '#1B365D', cursor: 'pointer',
}

const chipActiveStyle = {
  background: '#1B365D', color: '#fff', borderColor: '#1B365D',
}
