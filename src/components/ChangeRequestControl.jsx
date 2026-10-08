import { useEffect, useState } from 'react'

const STATUS_CHOICES = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'not_in_place', label: 'Not in Place' },
]

const smallBtn = {
  padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff',
  fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
}

// Shown in place of the status dropdown when a contributor opens an approved (In Place) point.
// The status can't be changed directly; instead the contributor sends a request with a reason,
// which lands in the approver's queue. The point stays approved until an approver decides.
// The parent keys this component by entry id, so its state resets when the point changes.
export default function ChangeRequestControl({ supabase, entryId, disabled = false }) {
  const [pending, setPending] = useState(undefined) // undefined = loading, null = none
  const [open, setOpen] = useState(false)
  const [requestedStatus, setRequestedStatus] = useState('in_progress')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Bumped after sending or cancelling so the pending request is re-read.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('point_change_requests')
        .select('id, requested_status, reason, created_at')
        .eq('entry_id', entryId)
        .eq('status', 'pending')
        .maybeSingle()
      if (!cancelled) setPending(data ?? null)
    })()
    return () => { cancelled = true }
  }, [entryId, supabase, reloadKey])

  async function send() {
    if (!reason.trim()) { setError('Please say why this needs to change.'); return }
    setBusy(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('request_point_status_change', {
      p_entry_id: entryId,
      p_requested_status: requestedStatus,
      p_reason: reason.trim(),
    })
    setBusy(false)
    if (rpcErr) { setError(rpcErr.message); return }
    setOpen(false)
    setReason('')
    setReloadKey(k => k + 1)
  }

  async function cancel() {
    setBusy(true)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('cancel_point_status_change', { p_request_id: pending.id })
    setBusy(false)
    if (rpcErr) { setError(rpcErr.message); return }
    setReloadKey(k => k + 1)
  }

  const labelFor = v => STATUS_CHOICES.find(s => s.value === v)?.label ?? v

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          padding: '4px 10px', borderRadius: 999, background: 'rgba(37,122,59,0.10)', color: '#257A3B',
          fontSize: '0.8rem', fontWeight: 600,
        }}>In Place</span>
        {pending === null && !open && (
          <button type="button" disabled={disabled} onClick={() => setOpen(true)} style={smallBtn}>Request a change</button>
        )}
      </div>

      {pending && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
          <strong>Change requested</strong> to {labelFor(pending.requested_status)}. Waiting for an approver.
          <div style={{ color: '#64748b' }}>“{pending.reason}”</div>
          <button type="button" disabled={busy || disabled} onClick={cancel} style={{ ...smallBtn, marginTop: 6 }}>
            {busy ? 'Cancelling…' : 'Cancel request'}
          </button>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={requestedStatus} onChange={e => setRequestedStatus(e.target.value)} disabled={busy}>
            {STATUS_CHOICES.map(s => <option key={s.value} value={s.value}>Change to {s.label}</option>)}
          </select>
          <textarea
            rows={2}
            placeholder="Why does this need to change?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={busy}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
              fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null) }} style={smallBtn}>Cancel</button>
            <button type="button" disabled={busy} onClick={send} style={{
              ...smallBtn, background: busy ? '#94a3b8' : '#1B365D', color: '#fff', border: 'none', fontWeight: 600,
            }}>{busy ? 'Sending…' : 'Send request'}</button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 6 }}>{error}</p>}
    </div>
  )
}
