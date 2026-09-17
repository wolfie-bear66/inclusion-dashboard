import { useEffect, useState } from 'react'
import { usePrincipleCoverage } from '../hooks/usePrincipleCoverage'
import { PRINCIPLE_LABEL_SHORT } from '../constants/principles'

const NAMED_PERSON = 'Named Person'
const POLICY = 'Policy / Published Document'
const SLOT_COUNT = 3
const SKIP_LIMIT = 3

function categoryRank(category) {
  if (category === NAMED_PERSON) return 0
  if (category === POLICY) return 1
  return 2
}

// props: schoolId, userId, firstName, supabase, openModal, closeModal, modalPoint,
// modalSaveMsg, onExit — the queue does its own live fetch of entries/assignments rather
// than reading App.jsx's own `entries` state, so it's correct regardless of what that
// state has loaded yet.
export default function MyPointsQueue({ schoolId, userId, firstName, supabase, openModal, closeModal, modalPoint, modalSaveMsg, onExit }) {
  const [loading, setLoading] = useState(true)
  // { slots: [{ point, pool }], pending: [{ point, pool }] } — kept as one state object so
  // popping the next candidate into a slot is a single atomic update, not two racing setters.
  const [queue, setQueue] = useState({ slots: [], pending: [] })
  const [pendingRefillPpId, setPendingRefillPpId] = useState(null)
  const [busyPpId, setBusyPpId] = useState(null)
  const [error, setError] = useState(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [successNote, setSuccessNote] = useState(null)

  const { principleData } = usePrincipleCoverage(supabase, schoolId, refreshToken)

  async function loadQueue() {
    setLoading(true)
    const [paRes, ppRes, sdRes, entriesRes, exclRes] = await Promise.all([
      supabase.from('point_assignments').select('provision_point_id, assignee_user_id').eq('school_id', schoolId),
      supabase.from('provision_points').select('id, label, category, principle, sub_domain_id').eq('active', true),
      supabase.from('sub_domains').select('id, domain_id'),
      supabase.from('entries').select('provision_point_id, status, submitted_for_approval_at').eq('school_id', schoolId),
      supabase.from('my_points_queue_state').select('provision_point_id, skip_count, acknowledged_at').eq('user_id', userId).eq('school_id', schoolId),
    ])

    const ppById = new Map((ppRes.data ?? []).map(p => [p.id, p]))
    const subDomainToDomain = new Map((sdRes.data ?? []).map(s => [s.id, s.domain_id]))
    const statusByPp = new Map((entriesRes.data ?? []).map(e => [e.provision_point_id, e.status]))
    // A point mid-approval is resolved as far as this queue is concerned — it shouldn't
    // resurface just because entries.status hasn't flipped to in_place yet (it can't, until
    // an approver acts). Confirmed live: without this, a point a contributor just submitted
    // reappeared on the very next fresh load.
    const pendingApprovalPp = new Set(
      (entriesRes.data ?? []).filter(e => e.submitted_for_approval_at).map(e => e.provision_point_id)
    )
    const exclByPp = new Map((exclRes.data ?? []).map(e => [e.provision_point_id, e]))
    const isExcluded = ppId => {
      const e = exclByPp.get(ppId)
      return !!e && (e.skip_count >= SKIP_LIMIT || !!e.acknowledged_at)
    }

    const myAssignedIds = new Set((paRes.data ?? []).filter(a => a.assignee_user_id === userId).map(a => a.provision_point_id))
    const schoolAssignedIds = new Set((paRes.data ?? []).map(a => a.provision_point_id))

    const myDomains = new Set(
      [...myAssignedIds].map(id => subDomainToDomain.get(ppById.get(id)?.sub_domain_id)).filter(Boolean)
    )

    const pool1 = [...myAssignedIds]
      .map(id => ppById.get(id))
      .filter(p => p && statusByPp.get(p.id) !== 'in_place' && !pendingApprovalPp.has(p.id) && !isExcluded(p.id))

    const unassigned = [...ppById.values()].filter(p => !schoolAssignedIds.has(p.id))
    const byCategoryThenLabel = (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.label.localeCompare(b.label)

    const pool2 = unassigned
      .filter(p => myDomains.has(subDomainToDomain.get(p.sub_domain_id)) && !isExcluded(p.id))
      .sort(byCategoryThenLabel)
    const pool3 = unassigned
      .filter(p => !myDomains.has(subDomainToDomain.get(p.sub_domain_id)) && !isExcluded(p.id))
      .sort(byCategoryThenLabel)

    const candidates = [
      ...pool1.map(point => ({ point, pool: 1 })),
      ...pool2.map(point => ({ point, pool: 2 })),
      ...pool3.map(point => ({ point, pool: 3 })),
    ]

    setQueue({ slots: candidates.slice(0, SLOT_COUNT), pending: candidates.slice(SLOT_COUNT) })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadQueue() }, [supabase, schoolId, userId])

  // Detects a successful save from the shared evidence modal (App.jsx's own
  // openModal/handleModalSave, unmodified) for whichever point this queue opened it for.
  // handleModalSave itself never touches entries.status (confirmed by tracing it — it only
  // ever writes evidence_entries), so this submits the entry for approval itself right after
  // the save, via the atomic submit_entry_for_approval RPC, rather than leaving it evidenced
  // but with no status at all.
  useEffect(() => {
    if (pendingRefillPpId && modalPoint?.id === pendingRefillPpId && modalSaveMsg === 'Saved.') {
      const ppId = pendingRefillPpId
      setPendingRefillPpId(null)
      closeModal()
      ;(async () => {
        const { data: entryRow, error: entryErr } = await supabase
          .from('entries')
          .select('id')
          .eq('school_id', schoolId)
          .eq('provision_point_id', ppId)
          .single()
        if (entryErr || !entryRow) {
          setError(entryErr?.message ?? 'Could not find the saved entry to submit for approval.')
          return
        }
        const { error: rpcErr } = await supabase.rpc('submit_entry_for_approval', {
          p_entry_id: entryRow.id,
          p_submitting_user_id: userId,
        })
        if (rpcErr) {
          setError(rpcErr.message)
          return
        }
        setSuccessNote('Submitted for approval.')
        refillSlotByPointId(ppId)
        setRefreshToken(t => t + 1)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPoint, modalSaveMsg, pendingRefillPpId])

  function refillSlotByPointId(ppId) {
    setQueue(prev => {
      const idx = prev.slots.findIndex(s => s.point.id === ppId)
      if (idx === -1) return prev
      const [next, ...restPending] = prev.pending
      const withoutSlot = prev.slots.filter((_, i) => i !== idx)
      const slots = next ? [...withoutSlot.slice(0, idx), next, ...withoutSlot.slice(idx)] : withoutSlot
      return { slots, pending: next ? restPending : prev.pending }
    })
  }

  async function handleConfirmNamedPerson(ppId) {
    setBusyPpId(ppId)
    setError(null)
    setSuccessNote(null)
    const { error: err } = await supabase.from('my_points_queue_state').upsert(
      [{ user_id: userId, school_id: schoolId, provision_point_id: ppId, acknowledged_at: new Date().toISOString() }],
      { onConflict: 'user_id,school_id,provision_point_id' }
    )
    setBusyPpId(null)
    if (err) { setError(err.message); return }
    setSuccessNote('Confirmed.')
    refillSlotByPointId(ppId)
  }

  function handleOpenEvidence(point) {
    setPendingRefillPpId(point.id)
    openModal({ id: point.id, label: point.label })
  }

  async function handleClaim(point) {
    setBusyPpId(point.id)
    setError(null)
    setSuccessNote(null)
    const { error: err } = await supabase.from('point_assignments').upsert(
      [{ provision_point_id: point.id, assignee_user_id: userId, school_id: schoolId, assigned_by: userId }],
      { onConflict: 'provision_point_id,school_id', ignoreDuplicates: true }
    )
    setBusyPpId(null)
    if (err) { setError(err.message); return }
    setQueue(prev => ({ ...prev, slots: prev.slots.map(s => s.point.id === point.id ? { ...s, pool: 1 } : s) }))
    if (point.category === NAMED_PERSON) {
      handleConfirmNamedPerson(point.id)
    } else {
      handleOpenEvidence(point)
    }
  }

  function handleSlotAction(slot) {
    if (busyPpId) return
    if (slot.pool !== 1) { handleClaim(slot.point); return }
    if (slot.point.category === NAMED_PERSON) handleConfirmNamedPerson(slot.point.id)
    else handleOpenEvidence(slot.point)
  }

  async function handleSkip(ppId) {
    if (busyPpId) return
    setBusyPpId(ppId)
    setError(null)
    setSuccessNote(null)
    const { data: existing } = await supabase
      .from('my_points_queue_state')
      .select('skip_count')
      .eq('user_id', userId).eq('school_id', schoolId).eq('provision_point_id', ppId)
      .maybeSingle()
    const nextCount = (existing?.skip_count ?? 0) + 1
    const { error: err } = await supabase.from('my_points_queue_state').upsert(
      [{ user_id: userId, school_id: schoolId, provision_point_id: ppId, skip_count: nextCount }],
      { onConflict: 'user_id,school_id,provision_point_id' }
    )
    setBusyPpId(null)
    if (err) { setError(err.message); return }
    refillSlotByPointId(ppId)
  }

  const emptyState = !loading && queue.slots.length === 0

  // z-index 150/151 — deliberately BELOW the general evidence modal's .modal-overlay
  // (App.css, z-index: 200), so opening it from here still receives clicks. Found live: at
  // 1050/1051 (matching BootstrapWizard/OnboardingPrompt, which never open the evidence
  // modal on top of themselves) this backdrop silently swallowed every click meant for the
  // modal underneath it. Still above the plain dashboard (default/auto stacking) and below
  // AssignmentModal (zIndex 1100), so "Browse other points" is unaffected.
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.50)' }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 151, overflowY: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
        width: '100%', maxWidth: 720, maxHeight: '88vh',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ background: '#1B365D', padding: '24px 28px 20px', flexShrink: 0 }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            Welcome{firstName ? `, ${firstName}` : ''}. Let's look at your points.
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', margin: '6px 0 0', lineHeight: 1.5 }}>
            A few at a time — confirm what's already yours, add evidence where it's needed, or pass on what isn't.
          </p>
        </div>

        <div style={{ padding: '14px 28px', borderBottom: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: 10, background: '#F7F8FA', flexShrink: 0 }}>
          {principleData.map(p => {
            const pct = p.total ? Math.round((p.inPlace / p.total) * 100) : 0
            return (
              <div key={p.principle} style={{ flex: '1 1 130px', minWidth: 130 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#475569', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{PRINCIPLE_LABEL_SHORT[p.principle] ?? p.principle}</span>
                  <span>{p.inPlace}/{p.total}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#1B365D', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading your points…</p>}

          {error && (
            <p style={{ color: '#991b1b', fontSize: '0.82rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </p>
          )}

          {!error && successNote && (
            <p style={{ color: '#166534', fontSize: '0.82rem' }}>{successNote}</p>
          )}

          {emptyState && (
            <div style={{ padding: '24px', textAlign: 'center', background: '#F7F8FA', borderRadius: 12, border: '1px dashed #E2E8F0' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Nothing left to look at right now.</p>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Head to the dashboard, or browse other points any time.</p>
            </div>
          )}

          {!loading && queue.slots.map(slot => {
            const { point, pool } = slot
            const isBusy = busyPpId === point.id
            const isNamedPerson = point.category === NAMED_PERSON
            return (
              <div key={point.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff',
              }}>
                <div style={{ flex: '1 1 220px' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', margin: 0 }}>{point.label}</p>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0' }}>
                    {point.category}{pool !== 1 ? ' — not yet assigned to you' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button type="button" onClick={() => handleSlotAction(slot)} disabled={isBusy} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: isBusy ? '#94a3b8' : '#1B365D', color: '#fff',
                    fontSize: '0.82rem', fontWeight: 600, cursor: isBusy ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}>
                    {isBusy
                      ? 'Saving…'
                      : pool !== 1
                        ? (isNamedPerson ? 'This is mine — confirm' : 'This is mine — add evidence')
                        : (isNamedPerson ? `Confirm you're the ${point.label}` : 'Add evidence')}
                  </button>
                  <button type="button" onClick={() => handleSkip(point.id)} disabled={isBusy} aria-label="Skip this point" style={{
                    background: 'none', border: 'none', cursor: isBusy ? 'default' : 'pointer',
                    color: '#94a3b8', fontSize: '1rem', padding: '4px 8px',
                  }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#64748b', cursor: 'pointer' }}>
            <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} style={{ accentColor: '#1B365D' }} />
            Don't show this again
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onExit({ action: 'browse', dontShowAgain })} style={{
              padding: '9px 16px', borderRadius: 8, border: '1px solid #1B365D', background: '#fff',
              color: '#1B365D', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Browse other points
            </button>
            <button type="button" onClick={() => onExit({ action: 'dashboard', dontShowAgain })} style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', background: '#1B365D',
              color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
