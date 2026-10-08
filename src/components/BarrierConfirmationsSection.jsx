import { useEffect, useState } from 'react'

// Approver-facing list of barriers added by contributors that are waiting for confirmation,
// shown inside the approval queue. Confirming makes the barrier a normal one (and lets it into
// the Inclusion Strategy and reports); declining removes it and sends the contributor a note.
export default function BarrierConfirmationsSection({ schoolId, supabase, isDemoMode, onCount, onChanged }) {
  const [barriers, setBarriers] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [declineFor, setDeclineFor] = useState(null)
  const [notes, setNotes] = useState({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('barriers')
        .select(`
          id, description, created_at,
          domains(name),
          submitter:profiles!barriers_submitted_by_fkey(first_name, last_name)
        `)
        .eq('school_id', schoolId)
        .eq('confirmation_status', 'pending')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (err) { setError('Failed to load barriers waiting for confirmation.'); setBarriers([]); onCount?.(0); return }
      setBarriers(data ?? [])
      onCount?.((data ?? []).length)
    })()
    return () => { cancelled = true }
  }, [schoolId, supabase, onCount])

  async function act(barrier, confirm) {
    if (isDemoMode) return
    setBusyId(barrier.id)
    setError(null)
    const { error: rpcErr } = confirm
      ? await supabase.rpc('confirm_barrier', { p_barrier_id: barrier.id })
      : await supabase.rpc('decline_barrier', { p_barrier_id: barrier.id, p_note: (notes[barrier.id] ?? '').trim() || null })
    setBusyId(null)
    if (rpcErr) { setError(rpcErr.message); return }
    setDeclineFor(null)
    setBarriers(prev => {
      const next = prev.filter(b => b.id !== barrier.id)
      onCount?.(next.length)
      return next
    })
    onChanged?.()
  }

  if (barriers === null || barriers.length === 0) {
    return error ? <p style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 12 }}>{error}</p> : null
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
        Barriers awaiting confirmation
      </p>
      {error && <p style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {barriers.map(b => {
          const who = [b.submitter?.first_name, b.submitter?.last_name].filter(Boolean).join(' ') || 'A contributor'
          const date = new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          const busy = busyId === b.id
          const declining = declineFor === b.id
          return (
            <div key={b.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>
                {who} added this on {date}{b.domains?.name ? ` · ${b.domains.name}` : ''}
              </p>
              <p style={{ fontSize: '0.88rem', color: '#1A202C', lineHeight: 1.55 }}>{b.description}</p>

              {declining && (
                <textarea
                  rows={2}
                  placeholder="Optional note for the contributor…"
                  value={notes[b.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [b.id]: e.target.value }))}
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
                    <button type="button" disabled={busy} onClick={() => act(b, false)} style={{
                      padding: '7px 16px', border: 'none', borderRadius: 8, background: busy ? '#94a3b8' : '#D4751A', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                    }}>{busy ? 'Declining…' : 'Decline barrier'}</button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busy} onClick={() => setDeclineFor(b.id)} style={{
                      padding: '7px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff',
                      fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
                    }}>Decline</button>
                    <button type="button" disabled={busy} onClick={() => act(b, true)} style={{
                      padding: '7px 16px', border: 'none', borderRadius: 8, background: busy ? '#94a3b8' : '#257A3B', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                    }}>{busy ? 'Confirming…' : 'Confirm barrier'}</button>
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
