import { useEffect, useState, useRef } from 'react'

const CATEGORY_ORDER = [
  'Named Person',
  'Policy / Published Document',
  'Monitoring & Data',
  'Staff Training & CPD',
  'External Partnership',
  'Family & Community Engagement',
  'Direct Provision for Students',
  'Internal Process / System',
]

// ── Shared mini components ────────────────────────────────────────────

function PillToggle({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', background: '#E2E8F0',
      borderRadius: 8, padding: 3, gap: 2,
    }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 16px', border: 'none', borderRadius: 6,
              fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
              background: active ? '#fff' : 'transparent',
              color: active ? '#1A202C' : '#64748b',
              fontWeight: active ? 600 : 400,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.12s',
            }}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
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

// ── Assignment modal ──────────────────────────────────────────────────

function AssignmentModal({ person, schoolId, currentUserId, supabase, onClose, onSaved }) {
  const [provisionPoints, setProvisionPoints] = useState([])
  const [checked, setChecked] = useState(new Set())
  const [originalAssigned, setOriginalAssigned] = useState(new Set())
  const [allAssignments, setAllAssignments] = useState([]) // all assignments for this school
  const [profilesById, setProfilesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch all active provision points
      const { data: ppData, error: ppErr } = await supabase
        .from('provision_points')
        .select('id, label, category, sub_domains(domains(name))')
        .eq('active', true)
        .order('label')

      // Fetch all point_assignments for this school
      const { data: assignData, error: assignErr } = await supabase
        .from('point_assignments')
        .select('id, provision_point_id, assignee_user_id')
        .eq('school_id', schoolId)

      // Fetch all profiles for this school (to show who holds conflicting assignments)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)

      if (ppErr || assignErr) {
        setError('Failed to load data.')
        setLoading(false)
        return
      }

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
  }

  function conflictFor(ppId) {
    if (!checked.has(ppId)) return null
    if (originalAssigned.has(ppId)) return null // already theirs
    const existing = allAssignments.find(
      a => a.provision_point_id === ppId && a.assignee_user_id !== person.id
    )
    if (!existing) return null
    const p = profilesById[existing.assignee_user_id]
    return p ? `${p.first_name} ${p.last_name}` : 'someone else'
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const toAdd = [...checked].filter(id => !originalAssigned.has(id))
    const toRemove = [...originalAssigned].filter(id => !checked.has(id))

    // Delete removed assignments for this person
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('point_assignments')
        .delete()
        .eq('school_id', schoolId)
        .eq('assignee_user_id', person.id)
        .in('provision_point_id', toRemove)
      if (delErr) { setError(delErr.message); setSaving(false); return }
    }

    // For conflicting adds: delete the existing assignment first
    const conflictIds = toAdd.filter(id =>
      allAssignments.some(a => a.provision_point_id === id && a.assignee_user_id !== person.id)
    )
    if (conflictIds.length > 0) {
      const { error: cDelErr } = await supabase
        .from('point_assignments')
        .delete()
        .eq('school_id', schoolId)
        .in('provision_point_id', conflictIds)
      if (cDelErr) { setError(cDelErr.message); setSaving(false); return }
    }

    // Insert new assignments
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
    onSaved()
    onClose()
  }

  // Group by category in order
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
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 640,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {loading ? (
            <p style={{ color: '#94a3b8', padding: '24px 0', fontSize: '0.85rem' }}>Loading provision points…</p>
          ) : (
            <>
              {grouped.map(({ cat, points }) => {
                return (
                  <div key={cat} style={{ paddingTop: 20 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A202C', marginBottom: 10 }}>
                      {cat}
                      <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                        {points.length} point{points.length !== 1 ? 's' : ''}
                      </span>
                    </p>
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
                              transition: 'background 0.1s',
                            }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggle(pp.id)}
                                style={{ marginTop: 2, accentColor: '#1B365D', flexShrink: 0 }}
                              />
                              <span style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45 }}>
                                {pp.label}
                              </span>
                            </label>
                            {conflict && (
                              <p style={{
                                fontSize: '0.72rem', color: '#d97706',
                                padding: '2px 10px 6px 38px', lineHeight: 1.4,
                              }}>
                                ⚠ Currently assigned to {conflict}. Saving will reassign it.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Skip instruction */}
                    <div style={{
                      marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <p style={{ fontSize: '0.72rem', color: '#94a3b8', flex: 1, lineHeight: 1.45 }}>
                        These points don't need an owner right now — skip to the next category.
                      </p>
                      <button type="button"
                        onClick={() => {
                          setChecked(prev => {
                            const next = new Set(prev)
                            points.forEach(pp => next.delete(pp.id))
                            return next
                          })
                        }}
                        style={{
                          marginLeft: 12, background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8',
                          fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '4px 0',
                          flexShrink: 0,
                        }}>
                        Skip this category →
                      </button>
                    </div>
                  </div>
                )
              })}
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

// ── By Person view ────────────────────────────────────────────────────

function ByPersonView({ schoolId, currentUserId, supabase }) {
  const [members, setMembers] = useState([])
  const [assignmentCounts, setAssignmentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalPerson, setModalPerson] = useState(null)

  async function loadData() {
    setLoading(true)

    const { data: profileData, error: pErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', schoolId)
      .neq('id', currentUserId)

    const { data: assignData } = await supabase
      .from('point_assignments')
      .select('assignee_user_id')
      .eq('school_id', schoolId)

    if (pErr) { setLoading(false); return }

    const counts = {}
    for (const a of assignData ?? []) {
      counts[a.assignee_user_id] = (counts[a.assignee_user_id] ?? 0) + 1
    }

    setMembers(profileData ?? [])
    setAssignmentCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [schoolId, currentUserId, supabase])

  if (loading) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading team…</p>

  if (members.length === 0) return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      background: '#F7F8FA', borderRadius: 12, border: '1px dashed #E2E8F0',
    }}>
      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 6 }}>
        No other team members yet
      </p>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
        Invite colleagues using the invite function to add them here.
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {members.map(m => {
        const count = assignmentCounts[m.id] ?? 0
        return (
          <div key={m.id} style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(27,54,93,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1B365D' }}>
                {(m.first_name?.[0] ?? '?').toUpperCase()}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1A202C', marginBottom: 3 }}>
                {m.first_name} {m.last_name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RoleChip role={m.role} />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {count === 0 ? 'No points assigned' : `${count} point${count !== 1 ? 's' : ''} assigned`}
                </span>
              </div>
            </div>

            <button type="button"
              onClick={() => setModalPerson(m)}
              style={{
                padding: '7px 16px', border: '1px solid #1B365D', borderRadius: 8,
                background: count > 0 ? 'rgba(27,54,93,0.08)' : '#1B365D',
                color: count > 0 ? '#1B365D' : '#fff',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
              {count > 0 ? 'Edit assignment' : 'Assign points'}
            </button>
          </div>
        )
      })}

      {modalPerson && (
        <AssignmentModal
          person={modalPerson}
          schoolId={schoolId}
          currentUserId={currentUserId}
          supabase={supabase}
          onClose={() => setModalPerson(null)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

// ── By Point view ─────────────────────────────────────────────────────

function ByPointView({ schoolId, supabase }) {
  const [provisionPoints, setProvisionPoints] = useState([])
  const [assignments, setAssignments] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [ppRes, assignRes, profileRes] = await Promise.all([
        supabase
          .from('provision_points')
          .select('id, label, category')
          .eq('active', true)
          .order('label'),
        supabase
          .from('point_assignments')
          .select('provision_point_id, assignee_user_id')
          .eq('school_id', schoolId),
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('school_id', schoolId),
      ])

      const byId = {}
      for (const p of profileRes.data ?? []) byId[p.id] = p

      setProvisionPoints(ppRes.data ?? [])
      setAssignments(assignRes.data ?? [])
      setProfilesById(byId)
      setLoading(false)
    }
    load()
  }, [schoolId, supabase])

  if (loading) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading…</p>

  const assignedSet = new Set(assignments.map(a => a.provision_point_id))
  const assigneeMap = {}
  for (const a of assignments) assigneeMap[a.provision_point_id] = a.assignee_user_id

  const unassigned = provisionPoints.filter(pp => !assignedSet.has(pp.id))
  const assigned   = provisionPoints.filter(pp =>  assignedSet.has(pp.id))

  function groupByCategory(points) {
    return CATEGORY_ORDER.map(cat => ({
      cat,
      points: points.filter(pp => pp.category === cat),
    })).filter(g => g.points.length > 0)
  }

  function PointList({ points, showOwner }) {
    const grouped = groupByCategory(points)
    if (grouped.length === 0) return (
      <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>None.</p>
    )
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {grouped.map(({ cat, points: pts }) => (
          <div key={cat}>
            <p style={{
              fontSize: '0.72rem', fontWeight: 700, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            }}>{cat} <span style={{ fontWeight: 400 }}>({pts.length})</span></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pts.map(pp => {
                const ownerId = assigneeMap[pp.id]
                const owner = ownerId ? profilesById[ownerId] : null
                return (
                  <div key={pp.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    background: '#F7F8FA', gap: 12,
                  }}>
                    <span style={{ fontSize: '0.82rem', color: '#334155', flex: 1, minWidth: 0 }}>
                      {pp.label}
                    </span>
                    {showOwner && owner && (
                      <span style={{
                        fontSize: '0.75rem', color: '#1B365D', fontWeight: 500,
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {owner.first_name} {owner.last_name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const sectionHead = (title, count, colour) => (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1A202C', marginBottom: 2 }}>
        {title}
        <span style={{
          marginLeft: 8, fontSize: '0.75rem', fontWeight: 600,
          padding: '2px 8px', borderRadius: 99,
          background: colour + '18', color: colour,
        }}>{count}</span>
      </h3>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        {sectionHead('Unassigned', unassigned.length, '#D4751A')}
        {unassigned.length === 0
          ? <p style={{ fontSize: '0.82rem', color: '#257A3B' }}>All points have an owner.</p>
          : <PointList points={unassigned} showOwner={false} />
        }
      </div>

      <div style={{ height: '1px', background: '#E2E8F0' }} />

      <div>
        {sectionHead('Assigned', assigned.length, '#257A3B')}
        {assigned.length === 0
          ? <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No points have been assigned yet.</p>
          : <PointList points={assigned} showOwner={true} />
        }
      </div>
    </div>
  )
}

// ── TeamPage ──────────────────────────────────────────────────────────

export default function TeamPage({ schoolId, currentUserId, supabase }) {
  const [view, setView] = useState('person')

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A202C', marginBottom: 4 }}>
          Team
        </h1>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
          Assign provision points to staff members. Each point can have one owner per school.
        </p>
      </div>

      {/* Toggle */}
      <div style={{ marginBottom: 24 }}>
        <PillToggle
          options={[
            { value: 'person', label: 'By Person' },
            { value: 'point',  label: 'By Point'  },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* View */}
      {view === 'person' && (
        <ByPersonView
          schoolId={schoolId}
          currentUserId={currentUserId}
          supabase={supabase}
        />
      )}
      {view === 'point' && (
        <ByPointView
          schoolId={schoolId}
          supabase={supabase}
        />
      )}
    </div>
  )
}
