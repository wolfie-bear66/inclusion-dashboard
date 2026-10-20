import { useEffect, useRef, useState } from 'react'

export const CATEGORY_ORDER = [
  'Named Person',
  'Policy / Published Document',
  'Monitoring & Data',
  'Staff Training & CPD',
  'External Partnership',
  'Family & Community Engagement',
  'Direct Provision for Students',
  'Internal Process / System',
]

const selectLinkStyle = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  fontSize: '0.75rem', fontWeight: 600, color: '#1B365D', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

function RoleChip({ role }) {
  const label = role === 'approver' ? 'Approver' : role === 'mat_admin' ? 'MAT Admin' : 'Contributor'
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: role === 'approver' ? 'rgba(27,54,93,0.10)' : '#F0F2F5',
      color: role === 'approver' ? '#1B365D' : '#64748b',
    }}>{label}</span>
  )
}

export default function AssignmentModal({ person, schoolId, currentUserId, supabase, onClose, onSaved }) {
  const [provisionPoints, setProvisionPoints] = useState([])
  const [checked, setChecked] = useState(new Set())
  const [originalAssigned, setOriginalAssigned] = useState(new Set())
  const [allAssignments, setAllAssignments] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [selectAllTicked, setSelectAllTicked] = useState(new Set()) // ids ticked by "Select all" this session
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const overlayRef = useRef(null)
  const bodyRef = useRef(null)
  const catRefs = useRef({})

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: ppData, error: ppErr } = await supabase
        .from('provision_points')
        .select('id, label, category, sub_domains(domains(name))')
        .eq('active', true)
        .order('label')

      const { data: assignData, error: assignErr } = await supabase
        .from('point_assignments')
        .select('id, provision_point_id, assignee_user_id')
        .eq('school_id', schoolId)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)

      if (ppErr || assignErr) { setError('Failed to load data.'); setLoading(false); return }

      const allAssign = assignData ?? []
      const myAssigned = new Set(
        allAssign.filter(a => a.assignee_user_id === person.id).map(a => a.provision_point_id)
      )
      const byId = {}
      for (const p of profileData ?? []) byId[p.id] = p

      setProvisionPoints(ppData ?? [])
      setAllAssignments(allAssign)
      setOriginalAssigned(myAssigned)
      setChecked(new Set(myAssigned))
      setProfilesById(byId)
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
    // A manual change takes the point out of "Select none"'s reach.
    setSelectAllTicked(prev => {
      if (!prev.has(ppId)) return prev
      const next = new Set(prev)
      next.delete(ppId)
      return next
    })
  }

  // Points anyone already holds (including this person). Select all only ever offers the rest.
  const heldIds = new Set(allAssignments.map(a => a.provision_point_id))

  function freeIdsIn(points) {
    return points.filter(pp => !heldIds.has(pp.id) && !checked.has(pp.id)).map(pp => pp.id)
  }

  function selectAllIn(points) {
    const ids = freeIdsIn(points)
    if (ids.length === 0) return
    setChecked(prev => new Set([...prev, ...ids]))
    setSelectAllTicked(prev => new Set([...prev, ...ids]))
  }

  // Undoes only what Select all ticked in this category; points that were already yours, or that
  // you ticked by hand, are left alone.
  function selectNoneIn(points) {
    const ids = points.filter(pp => selectAllTicked.has(pp.id) && checked.has(pp.id)).map(pp => pp.id)
    if (ids.length === 0) return
    setChecked(prev => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    setSelectAllTicked(prev => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  function conflictFor(ppId) {
    if (!checked.has(ppId) || originalAssigned.has(ppId)) return null
    const existing = allAssignments.find(
      a => a.provision_point_id === ppId && a.assignee_user_id !== person.id
    )
    if (!existing) return null
    const p = profilesById[existing.assignee_user_id]
    return p ? `${p.first_name} ${p.last_name}` : 'someone else'
  }

  async function handleSave() {
    setSaving(true); setError(null)
    const toAdd = [...checked].filter(id => !originalAssigned.has(id))
    const toRemove = [...originalAssigned].filter(id => !checked.has(id))

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('point_assignments').delete()
        .eq('school_id', schoolId).eq('assignee_user_id', person.id).in('provision_point_id', toRemove)
      if (delErr) { setError(delErr.message); setSaving(false); return }
    }

    const conflictIds = toAdd.filter(id =>
      allAssignments.some(a => a.provision_point_id === id && a.assignee_user_id !== person.id)
    )
    if (conflictIds.length > 0) {
      const { error: cDelErr } = await supabase
        .from('point_assignments').delete()
        .eq('school_id', schoolId).in('provision_point_id', conflictIds)
      if (cDelErr) { setError(cDelErr.message); setSaving(false); return }
    }

    if (toAdd.length > 0) {
      const rows = toAdd.map(ppId => ({
        provision_point_id: ppId,
        assignee_user_id: person.id,
        school_id: schoolId,
        assigned_by: currentUserId,
      }))
      const { error: insErr } = await supabase.from('point_assignments').insert(rows)
      if (insErr) { setError(insErr.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    points: provisionPoints.filter(pp => pp.category === cat),
  })).filter(g => g.points.length > 0)

  const checkedCount = checked.size

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
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
              {person.first_name} {person.last_name}
            </h2>
            <RoleChip role={person.role} />
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1, fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', padding: '24px 0', fontSize: '0.85rem' }}>Loading provision points…</p>
          ) : (
            <>
              {grouped.map(({ cat, points }, catIdx) => (
                <div key={cat} ref={el => { catRefs.current[catIdx] = el }} style={{ paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A202C' }}>
                      {cat}
                      <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                        {points.length} point{points.length !== 1 ? 's' : ''}
                      </span>
                    </p>
                    {(() => {
                      const freeCount = freeIdsIn(points).length
                      const undoable = points.some(pp => selectAllTicked.has(pp.id) && checked.has(pp.id))
                      if (freeCount === 0 && !undoable) return null
                      // Tick box: empty (or part-filled once some are ticked) while free points
                      // remain; filled once every free point has been ticked by Select all.
                      const allTicked = freeCount === 0
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#1B365D', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              ref={el => { if (el) el.indeterminate = !allTicked && undoable }}
                              checked={allTicked}
                              onChange={() => (allTicked ? selectNoneIn(points) : selectAllIn(points))}
                              aria-label={allTicked ? 'Untick the points Select all ticked in this category' : `Select all ${freeCount} free points in this category`}
                              style={{ accentColor: '#1B365D', cursor: 'pointer' }}
                            />
                            {allTicked ? 'All free selected' : `Select all (${freeCount} free)`}
                          </label>
                          {undoable && (
                            <button type="button" onClick={() => selectNoneIn(points)} style={selectLinkStyle}>
                              Select none
                            </button>
                          )}
                        </span>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {points.map(pp => {
                      const isChecked = checked.has(pp.id)
                      const conflict = conflictFor(pp.id)
                      return (
                        <div key={pp.id}>
                          <label style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                            background: isChecked ? 'rgba(27,54,93,0.05)' : 'transparent',
                          }}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggle(pp.id)}
                              style={{ marginTop: 2, accentColor: '#1B365D', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45 }}>{pp.label}</span>
                          </label>
                          {conflict && (
                            <p style={{ fontSize: '0.72rem', color: '#d97706', padding: '2px 10px 6px 38px', lineHeight: 1.4 }}>
                              ⚠ Currently assigned to {conflict}. Saving will reassign it.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{
                    marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', flex: 1, lineHeight: 1.45 }}>
                      Move on without changing this category's selections.
                    </p>
                    <button type="button"
                      onClick={() => {
                        const next = catRefs.current[catIdx + 1]
                        if (next && bodyRef.current) {
                          bodyRef.current.scrollTo({ top: next.offsetTop - 8, behavior: 'smooth' })
                        }
                      }}
                      style={{
                        marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'inherit',
                        whiteSpace: 'nowrap', padding: '4px 0', flexShrink: 0,
                      }}>
                      Skip this category →
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ height: 24 }} />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 12,
        }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {checkedCount} point{checkedCount !== 1 ? 's' : ''} selected
          </div>
          {error && <p style={{ fontSize: '0.78rem', color: '#dc2626', flex: 1 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: 8,
              background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#475569',
            }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || loading} style={{
              padding: '8px 20px', border: 'none', borderRadius: 8,
              background: saving || loading ? '#94a3b8' : '#1B365D',
              color: '#fff', fontSize: '0.82rem', fontWeight: 600,
              cursor: saving || loading ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? 'Saving…' : 'Save assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
