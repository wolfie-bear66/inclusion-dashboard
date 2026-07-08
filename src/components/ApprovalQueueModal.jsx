import { useEffect, useState } from 'react'
import EvidenceSummaryView from './EvidenceSummaryView'

function mostRecentEvidence(evidenceList) {
  if (!evidenceList || evidenceList.length === 0) return null
  return [...evidenceList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
}

export default function ApprovalQueueModal({ schoolId, currentUserId, supabase, onClose, onActioned, isDemoMode }) {
  const [items, setItems] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [actioningId, setActioningId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({}) // entryId -> note text
  const [openNoteFor, setOpenNoteFor] = useState(null)

  async function load() {
    setError(null)
    const { data, error: err } = await supabase
      .from('entries')
      .select(`
        id, provision_point_id, status, submitted_for_approval_at,
        provision_points(id, label, category),
        evidence_entries(id, brief_description, cost, date_started, date_last_reviewed, next_review_due, supporting_document_link, intended_outcomes, impact_on_outcomes, created_at)
      `)
      .eq('school_id', schoolId)
      .not('submitted_for_approval_at', 'is', null)
      .order('submitted_for_approval_at', { ascending: true })

    if (err) { setError('Failed to load the approval queue.'); setItems([]); return }
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [schoolId, supabase])

  async function handleConfirm(entry) {
    if (isDemoMode) return
    setActioningId(entry.id)
    setError(null)
    const { error: updErr } = await supabase
      .from('entries')
      .update({ status: 'in_place', submitted_for_approval_at: null })
      .eq('id', entry.id)
    if (updErr) { setError(updErr.message); setActioningId(null); return }

    const { error: logErr } = await supabase.from('point_approval_log').insert({
      entry_id: entry.id,
      school_id: schoolId,
      action: 'confirmed',
      actioned_by: currentUserId,
    })
    if (logErr) console.error('Error logging confirmation:', logErr)

    onActioned?.(entry.provision_point_id, { status: 'in_place', submitted_for_approval_at: null })
    setItems(prev => prev.filter(i => i.id !== entry.id))
    setActioningId(null)
  }

  async function handleSendBack(entry) {
    if (isDemoMode) return
    const note = (noteDrafts[entry.id] ?? '').trim()
    setActioningId(entry.id)
    setError(null)
    const { error: updErr } = await supabase
      .from('entries')
      .update({ status: 'in_progress', submitted_for_approval_at: null, send_back_note: note || null })
      .eq('id', entry.id)
    if (updErr) { setError(updErr.message); setActioningId(null); return }

    const { error: logErr } = await supabase.from('point_approval_log').insert({
      entry_id: entry.id,
      school_id: schoolId,
      action: 'sent_back',
      actioned_by: currentUserId,
      note: note || null,
    })
    if (logErr) console.error('Error logging send-back:', logErr)

    onActioned?.(entry.provision_point_id, { status: 'in_progress', submitted_for_approval_at: null, send_back_note: note || null })
    setItems(prev => prev.filter(i => i.id !== entry.id))
    setActioningId(null)
    setOpenNoteFor(null)
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
        width: '100%', maxWidth: 680, maxHeight: '90vh',
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
              Approval queue
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Points submitted by contributors, awaiting confirmation.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1, fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {error && <p style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 12 }}>{error}</p>}

          {items === null ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading…</p>
          ) : items.length === 0 ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center',
              background: '#F7F8FA', borderRadius: 12, border: '1px dashed #E2E8F0',
            }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C' }}>Nothing waiting for approval.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map(entry => {
                const label = entry.provision_points?.label ?? 'Untitled point'
                const submittedDate = new Date(entry.submitted_for_approval_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                const evidence = mostRecentEvidence(entry.evidence_entries)
                const busy = actioningId === entry.id
                const noteOpen = openNoteFor === entry.id

                return (
                  <div key={entry.id} style={{
                    border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                      <div>
                        <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1A202C' }}>{label}</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Submitted {submittedDate}</p>
                      </div>
                    </div>

                    <EvidenceSummaryView evidence={evidence} />

                    {noteOpen && (
                      <div style={{ marginTop: 10 }}>
                        <textarea
                          rows={2}
                          placeholder="Optional note for the contributor…"
                          value={noteDrafts[entry.id] ?? ''}
                          onChange={e => setNoteDrafts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                          style={{
                            width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
                            fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      {noteOpen ? (
                        <>
                          <button type="button" disabled={busy} onClick={() => setOpenNoteFor(null)} style={{
                            padding: '7px 14px', border: '1px solid #E2E8F0', borderRadius: 8,
                            background: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
                          }}>Cancel</button>
                          <button type="button" disabled={busy} onClick={() => handleSendBack(entry)} style={{
                            padding: '7px 16px', border: 'none', borderRadius: 8,
                            background: busy ? '#94a3b8' : '#D4751A', color: '#fff',
                            fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                          }}>{busy ? 'Sending back…' : 'Send back'}</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={busy} onClick={() => setOpenNoteFor(entry.id)} style={{
                            padding: '7px 14px', border: '1px solid #E2E8F0', borderRadius: 8,
                            background: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
                          }}>Send back</button>
                          <button type="button" disabled={busy} onClick={() => handleConfirm(entry)} style={{
                            padding: '7px 16px', border: 'none', borderRadius: 8,
                            background: busy ? '#94a3b8' : '#257A3B', color: '#fff',
                            fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                          }}>{busy ? 'Confirming…' : 'Confirm'}</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
