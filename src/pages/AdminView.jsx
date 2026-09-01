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
const ENGAGEMENT_LABEL = { active: 'Active', stalled: 'Stalled', never_logged_in: 'Never logged in' }
const ENGAGEMENT_COLOUR = { active: '#22c55e', stalled: '#f97316', never_logged_in: '#94a3b8' }

function fmtDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0)
}

export default function AdminView() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingRow, setEditingRow] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)

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
      setActionMsg({ type: 'success', text: `Invite resent to ${json.email}` })
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
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
          <a href="/" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
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

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#1B365D', color: '#fff' }}>
                  <Th>School</Th>
                  <Th>Status</Th>
                  <Th>Price</Th>
                  <Th>Confirmed</Th>
                  <Th>Staff</Th>
                  <Th>Engagement</Th>
                  <Th>Last login</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <Td style={{ fontWeight: 600, color: '#1B365D' }}>{row.name}</Td>
                    <Td><Pill colour={STATUS_COLOUR[row.subscription_status]}>{STATUS_LABEL[row.subscription_status]}</Pill></Td>
                    <Td>{row.annual_price ? fmtMoney(row.annual_price) : (row.price_tier ?? '—')}</Td>
                    <Td>{fmtDate(row.confirmed_at)}</Td>
                    <Td>{row.staff_count}</Td>
                    <Td><Pill colour={ENGAGEMENT_COLOUR[row.engagement_status]}>{ENGAGEMENT_LABEL[row.engagement_status]}</Pill></Td>
                    <Td>{fmtDate(row.last_login)}</Td>
                    <Td>
                      <button onClick={() => setEditingRow(row)} style={actionBtnStyle}>Edit</button>
                      {row.pending_invites.map(p => (
                        <button
                          key={p.profile_id}
                          onClick={() => handleResendInvite(p.profile_id)}
                          title={p.email ?? ''}
                          style={{ ...actionBtnStyle, marginLeft: 6 }}
                        >
                          Resend{row.pending_invites.length > 1 ? ` (${p.email?.split('@')[0] ?? '?'})` : ' invite'}
                        </button>
                      ))}
                    </Td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No schools found.</td></tr>
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

function Th({ children }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{children}</th>
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
