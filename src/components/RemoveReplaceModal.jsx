import { useEffect, useState } from 'react'
import { CATEGORY_ORDER } from './AssignmentModal'

const FUNCTION_URL = 'https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/remove-team-member'
const PUBLISHABLE_KEY = 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb'

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: '0.85rem', fontFamily: 'inherit', color: '#1A202C', boxSizing: 'border-box',
}
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }

export default function RemoveReplaceModal({ person, schoolId, currentUserId, supabase, teamMembers, onClose, onRemoved }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assignedPoints, setAssignedPoints] = useState([]) // [{ id, label, category }]
  const [checked, setChecked] = useState(new Set())
  const [replacementMode, setReplacementMode] = useState('existing') // 'existing' | 'new'
  const [replacementId, setReplacementId] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newJobTitle, setNewJobTitle] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [step, setStep] = useState('select') // 'select' | 'confirm'
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: ppData, error: ppErr } = await supabase
        .from('provision_points')
        .select('id, label, category')
        .eq('active', true)
        .order('label')
      const { data: assignData, error: assignErr } = await supabase
        .from('point_assignments')
        .select('provision_point_id')
        .eq('school_id', schoolId)
        .eq('assignee_user_id', person.id)

      if (ppErr || assignErr) { setError('Failed to load this person\'s assigned points.'); setLoading(false); return }

      const assignedIds = new Set((assignData ?? []).map(a => a.provision_point_id))
      const points = (ppData ?? []).filter(pp => assignedIds.has(pp.id))
      setAssignedPoints(points)
      setChecked(new Set(points.map(pp => pp.id))) // ticked by default
      setLoading(false)
    }
    load()
  }, [person.id, schoolId, supabase])

  function toggle(ppId) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(ppId)) next.delete(ppId)
      else next.add(ppId)
      return next
    })
  }

  function untickAll() {
    setChecked(new Set())
  }

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    points: assignedPoints.filter(pp => pp.category === cat),
  })).filter(g => g.points.length > 0)

  const tickedCount = checked.size
  const untickedCount = assignedPoints.length - tickedCount

  const replacementReady = tickedCount === 0
    ? true
    : replacementMode === 'existing'
      ? !!replacementId
      : (newFirstName.trim() && newLastName.trim() && newEmail.trim())

  const replacementLabel = tickedCount === 0
    ? null
    : replacementMode === 'existing'
      ? (teamMembers.find(m => m.id === replacementId)
          ? `${teamMembers.find(m => m.id === replacementId).first_name} ${teamMembers.find(m => m.id === replacementId).last_name}`
          : '')
      : `${newFirstName.trim()} ${newLastName.trim()}`.trim()

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      const point_decisions = assignedPoints.map(pp => {
        if (checked.has(pp.id)) {
          return {
            provision_point_id: pp.id,
            action: 'reassign',
            replacement_user_id: replacementMode === 'existing' ? replacementId : 'new',
          }
        }
        return { provision_point_id: pp.id, action: 'unassign' }
      })

      const new_person = (tickedCount > 0 && replacementMode === 'new')
        ? { first_name: newFirstName.trim(), last_name: newLastName.trim(), job_title: newJobTitle.trim(), email: newEmail.trim() }
        : null

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ departing_user_id: person.id, point_decisions, new_person }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      onRemoved?.()
      onClose()
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.50)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 640, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A202C', marginBottom: 4 }}>
              Remove {person.first_name} {person.last_name}
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {step === 'select' ? 'Choose what happens to their assigned points.' : 'Confirm this removal.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1, fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading assigned points…</p>
          ) : step === 'select' ? (
            <>
              {assignedPoints.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {person.first_name} has no provision points currently assigned.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Ticked points will be reassigned. Unticked points become unassigned.
                    </p>
                    <button type="button" onClick={untickAll} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', color: '#1B365D', fontWeight: 600, fontFamily: 'inherit',
                    }}>Untick all</button>
                  </div>

                  {grouped.map(({ cat, points }) => (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A202C', marginBottom: 8 }}>
                        {cat}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {points.map(pp => (
                          <label key={pp.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                            background: checked.has(pp.id) ? 'rgba(27,54,93,0.05)' : 'transparent',
                          }}>
                            <input type="checkbox" checked={checked.has(pp.id)} onChange={() => toggle(pp.id)}
                              style={{ marginTop: 2, accentColor: '#1B365D', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45 }}>{pp.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div style={{ height: 1, background: '#E2E8F0', margin: '16px 0' }} />

                  <p style={labelStyle}>Reassign ticked points to</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button type="button" onClick={() => setReplacementMode('existing')} style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: replacementMode === 'existing' ? '1px solid #1B365D' : '1px solid #E2E8F0',
                      background: replacementMode === 'existing' ? 'rgba(27,54,93,0.06)' : '#fff',
                      color: '#1A202C', fontSize: '0.82rem', fontWeight: 600,
                    }}>Existing team member</button>
                    <button type="button" onClick={() => setReplacementMode('new')} style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: replacementMode === 'new' ? '1px solid #1B365D' : '1px solid #E2E8F0',
                      background: replacementMode === 'new' ? 'rgba(27,54,93,0.06)' : '#fff',
                      color: '#1A202C', fontSize: '0.82rem', fontWeight: 600,
                    }}>+ Add new person</button>
                  </div>

                  {replacementMode === 'existing' ? (
                    <select value={replacementId} onChange={e => setReplacementId(e.target.value)} style={inputStyle}>
                      <option value="">Select a team member…</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={labelStyle}>First name</p>
                          <input style={inputStyle} value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={labelStyle}>Last name</p>
                          <input style={inputStyle} value={newLastName} onChange={e => setNewLastName(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <p style={labelStyle}>Job title</p>
                        <input style={inputStyle} value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} />
                      </div>
                      <div>
                        <p style={labelStyle}>Email</p>
                        <input type="email" style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '16px 18px',
            }}>
              <p style={{ fontSize: '0.88rem', color: '#1A202C', lineHeight: 1.6, marginBottom: 0 }}>
                {tickedCount > 0 && (
                  <>{tickedCount} point{tickedCount !== 1 ? 's' : ''} will move to <strong>{replacementLabel}</strong>.<br /></>
                )}
                {untickedCount > 0 && (
                  <>{untickedCount} point{untickedCount !== 1 ? 's' : ''} will become unassigned.<br /></>
                )}
                <strong>{person.first_name} {person.last_name}'s</strong> account will be permanently removed. This cannot be undone.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          flexShrink: 0, gap: 8,
        }}>
          {error && <p style={{ fontSize: '0.78rem', color: '#dc2626', flex: 1 }}>{error}</p>}
          {step === 'select' ? (
            <>
              <button type="button" onClick={onClose} style={{
                padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: 8,
                background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
              }}>Cancel</button>
              <button type="button" disabled={!replacementReady || loading} onClick={() => setStep('confirm')} style={{
                padding: '8px 20px', border: 'none', borderRadius: 8,
                background: (!replacementReady || loading) ? '#94a3b8' : '#1B365D',
                color: '#fff', fontSize: '0.82rem', fontWeight: 600,
                cursor: (!replacementReady || loading) ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>Continue</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setStep('select')} disabled={submitting} style={{
                padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: 8,
                background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
              }}>Back</button>
              <button type="button" onClick={handleConfirm} disabled={submitting} style={{
                padding: '8px 20px', border: 'none', borderRadius: 8,
                background: submitting ? '#94a3b8' : '#EA4335',
                color: '#fff', fontSize: '0.82rem', fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>
                {submitting ? 'Removing…' : 'Confirm removal'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
