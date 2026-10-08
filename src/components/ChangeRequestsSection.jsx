import { useEffect, useState } from 'react'

const STATUS_LABEL = { in_progress: 'In Progress', not_in_place: 'Not in Place' }

// Approver-facing list of pending change requests on approved points, shown inside the approval
// queue. Accepting changes the point's status (done by the decide_point_status_change function,
// which also notifies the contributor); declining leaves the point approved and sends back a note.
export default function ChangeRequestsSection({ schoolId, supabase, isDemoMode, onCount, onDecided }) {
  const [requests, setRequests] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [declineFor, setDeclineFor] = useState(null)
  const [notes, setNotes] = useState({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('point_change_requests')
        .select(`
          id, entry_id, requested_status, reason, created_at,
          requester:profiles!point_change_requests_requested_by_fkey(first_name, last_name),
          entries(provision_point_id, provision_points(label))
        `)
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (err) { setError('Failed to load change requests.'); setRequests([]); onCount?.(0); return }
      setRequests(data ?? [])
      onCount?.((data ?? []).length)
    })()
    return () => { cancelled = true }
  }, [schoolId, supabase, onCount])

  async function decide(req, accept) {
    if (isDemoMode) return
    setBusyId(req.id)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('decide_point_status_change', {
      p_request_id: req.id,
      p_accept: accept,
      p_note: (notes[req.id] ?? '').trim() || null,
    })
    setBusyId(null)
    if (rpcErr) { setError(rpcErr.message); return }
    setDeclineFor(null)
    onDecided?.(req.entries?.provision_point_id, accept ? { status: req.requested_status } : {})
    setRequests(prev => {
      const next = prev.filter(r => r.id !== req.id)
      onCount?.(next.length)
      return next
    })
  }

  if (requests === null || requests.length === 0) {
    return error ? <p style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 12 }}>{error}</p> : null
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
        Change requests
      </p>
      {error && <p style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {requests.map(req => {
          const label = req.entries?.provision_points?.label ?? 'Untitled point'
          const who = [req.requester?.first_name, req.requester?.last_name].filter(Boolean).join(' ') || 'A contributor'
          const date = new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          const busy = busyId === req.id
          const declining = declineFor === req.id
          return (
            <div key={req.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1A202C', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 10 }}>
                {who} asked on {date} to change this approved point to <strong>{STATUS_LABEL[req.requested_status] ?? req.requested_status}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: '#1A202C', lineHeight: 1.5 }}>“{req.reason}”</p>

              {declining && (
                <textarea
                  rows={2}
                  placeholder="Optional note for the contributor…"
                  value={notes[req.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 10,
                    fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                  }}
                />
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                {declining ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => setDeclineFor(null)} style={{
                      padding: '7px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff',
                      fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
                    }}>Cancel</button>
                    <button type="button" disabled={busy} onClick={() => decide(req, false)} style={{
                      padding: '7px 16px', border: 'none', borderRadius: 8, background: busy ? '#94a3b8' : '#D4751A', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                    }}>{busy ? 'Declining…' : 'Decline request'}</button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busy} onClick={() => setDeclineFor(req.id)} style={{
                      padding: '7px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff',
                      fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
                    }}>Decline</button>
                    <button type="button" disabled={busy} onClick={() => decide(req, true)} style={{
                      padding: '7px 16px', border: 'none', borderRadius: 8, background: busy ? '#94a3b8' : '#257A3B', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                    }}>{busy ? 'Accepting…' : 'Accept change'}</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
