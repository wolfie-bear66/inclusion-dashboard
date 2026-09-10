import { useEffect, useRef, useState } from 'react'
import AssignmentModal, { CATEGORY_ORDER } from '../components/AssignmentModal'
import RemoveReplaceModal from '../components/RemoveReplaceModal'

const INVITE_FUNCTION_URL = 'https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/invite-user'
const PUBLISHABLE_KEY = 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb'

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: '0.85rem', fontFamily: 'inherit', color: '#1A202C', boxSizing: 'border-box',
}
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }

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

// ── By Person view ────────────────────────────────────────────────────

function ByPersonView({ schoolId, currentUserId, supabase, readOnly, userRole, onInviteUser }) {
  const [members, setMembers] = useState([])
  const [assignmentCounts, setAssignmentCounts] = useState({})
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalPerson, setModalPerson] = useState(null)
  const [removePerson, setRemovePerson] = useState(null)

  async function loadData() {
    console.log('[team] fetch function entered');
    setLoading(true)

    console.log('[team] schoolId:', schoolId, 'currentUserId:', currentUserId);
    const { data: profileData, error: pErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, job_title')
      .eq('school_id', schoolId)
      .neq('id', currentUserId)
    console.log('[team] query result:', JSON.stringify(profileData), 'error:', pErr);

    const { data: assignData } = await supabase
      .from('point_assignments')
      .select('assignee_user_id')
      .eq('school_id', schoolId)

    const { count: activeCount } = await supabase
      .from('provision_points')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)

    if (pErr) { setLoading(false); return }

    const counts = {}
    for (const a of assignData ?? []) {
      counts[a.assignee_user_id] = (counts[a.assignee_user_id] ?? 0) + 1
    }

    setMembers(profileData ?? [])
    setAssignmentCounts(counts)
    setUnassignedCount(Math.max((activeCount ?? 0) - (assignData?.length ?? 0), 0))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [schoolId, currentUserId, supabase])

  if (loading) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading team…</p>

  if (members.length === 0) return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: '#F7F8FA', borderRadius: 12, border: '1px dashed #E2E8F0',
    }}>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1A202C', marginBottom: 8 }}>
        No one's been assigned yet
      </p>
      <p style={{ fontSize: '0.85rem', color: '#D4751A', fontWeight: 600, marginBottom: 20 }}>
        {unassignedCount} point{unassignedCount !== 1 ? 's' : ''} need{unassignedCount === 1 ? 's' : ''} an owner
      </p>
      {!readOnly && onInviteUser && (
        <button type="button" onClick={onInviteUser} style={{
          padding: '9px 20px', border: 'none', borderRadius: 8,
          background: '#1B365D', color: '#fff',
          fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Invite your first team member
        </button>
      )}
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
                {m.job_title
                  ? <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>{m.job_title}</span>
                  : <RoleChip role={m.role} />
                }
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {count === 0 ? 'No points assigned' : `${count} point${count !== 1 ? 's' : ''} assigned`}
                </span>
              </div>
            </div>

            {!readOnly && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button"
                  onClick={() => setModalPerson(m)}
                  style={{
                    padding: '7px 16px', border: '1px solid #1B365D', borderRadius: 8,
                    background: count > 0 ? 'rgba(27,54,93,0.08)' : '#1B365D',
                    color: count > 0 ? '#1B365D' : '#fff',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}>
                  {count > 0 ? 'Edit assignment' : 'Assign points'}
                </button>
                {userRole === 'approver' && (
                  <button type="button"
                    onClick={() => setRemovePerson(m)}
                    style={{
                      padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: 8,
                      background: '#fff', color: '#EA4335',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {modalPerson && !readOnly && (
        <AssignmentModal
          person={modalPerson}
          schoolId={schoolId}
          currentUserId={currentUserId}
          supabase={supabase}
          onClose={() => setModalPerson(null)}
          onSaved={loadData}
        />
      )}

      {removePerson && !readOnly && userRole === 'approver' && (
        <RemoveReplaceModal
          person={removePerson}
          schoolId={schoolId}
          currentUserId={currentUserId}
          supabase={supabase}
          teamMembers={members.filter(m => m.id !== removePerson.id)}
          onClose={() => setRemovePerson(null)}
          onRemoved={loadData}
        />
      )}
    </div>
  )
}

// ── By Point view ─────────────────────────────────────────────────────

function CategorySelectAllCheckbox({ points, selected, onToggleCategory }) {
  const ref = useRef(null)
  const ids = points.map(p => p.id)
  const selectedCount = ids.filter(id => selected.has(id)).length
  const allSelected = ids.length > 0 && selectedCount === ids.length
  const someSelected = selectedCount > 0 && !allSelected

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected
  }, [someSelected])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={() => onToggleCategory(ids, allSelected)}
      style={{ accentColor: '#1B365D', cursor: 'pointer', marginRight: 8 }}
      aria-label="Select all in this category"
    />
  )
}

function BulkAssignBar({ selectedIds, members, schoolId, currentUserId, matId, supabase, onDone, onClear }) {
  const [target, setTarget] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newJobTitle, setNewJobTitle] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const count = selectedIds.size

  function handleSelectChange(e) {
    const val = e.target.value
    setError(null)
    if (val === '__new__') {
      setShowNewForm(true)
      setTarget('')
    } else {
      setShowNewForm(false)
      setTarget(val)
    }
  }

  async function assignRows(assigneeUserId) {
    const rows = [...selectedIds].map(ppId => ({
      provision_point_id: ppId,
      assignee_user_id: assigneeUserId,
      school_id: schoolId,
      assigned_by: currentUserId,
    }))
    return supabase
      .from('point_assignments')
      .upsert(rows, { onConflict: 'provision_point_id,school_id', ignoreDuplicates: true })
  }

  async function handleAssignExisting() {
    if (!target) return
    setBusy(true); setError(null)
    const { error: insErr } = await assignRows(target)
    setBusy(false)
    if (insErr) { setError(insErr.message); return }
    onDone()
  }

  async function handleCreateAndAssign(e) {
    e.preventDefault()
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) return
    setBusy(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(INVITE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          first_name: newFirstName.trim(),
          last_name:  newLastName.trim(),
          job_title:  newJobTitle.trim(),
          email:      newEmail.trim(),
          role:       'contributor',
          school_id:  schoolId,
          mat_id:     matId,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setBusy(false)
        return
      }
      if (json.profileError || !json.userId) {
        setError('Invite sent but the profile could not be created automatically — please contact hello@inclusiondashboard.co.uk.')
        setBusy(false)
        return
      }
      if (newJobTitle.trim()) {
        const { error: jobTitleError } = await supabase
          .from('profiles')
          .update({ job_title: newJobTitle.trim() })
          .eq('id', json.userId)
        if (jobTitleError) console.warn('[team-bulk-assign] job_title update failed:', jobTitleError.message)
      }
      const { error: insErr } = await assignRows(json.userId)
      setBusy(false)
      if (insErr) { setError(insErr.message); return }
      onDone()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'sticky', bottom: 0, background: '#fff',
      border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '14px 18px', marginTop: 8,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', flexShrink: 0 }}>
          {count} point{count !== 1 ? 's' : ''} selected
        </span>

        <select
          value={showNewForm ? '__new__' : target}
          onChange={handleSelectChange}
          disabled={busy}
          style={{
            padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
            fontSize: '0.82rem', fontFamily: 'inherit', color: '#1A202C',
            background: '#fff', minWidth: 200,
          }}
        >
          <option value="" disabled>Assign to…</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}{m.job_title ? ` — ${m.job_title}` : ''}
            </option>
          ))}
          <option value="__new__">+ Add new team member</option>
        </select>

        {!showNewForm && target && (
          <button type="button" onClick={handleAssignExisting} disabled={busy} style={{
            padding: '7px 16px', border: 'none', borderRadius: 8,
            background: busy ? '#94a3b8' : '#1B365D', color: '#fff',
            fontSize: '0.82rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            {busy ? 'Assigning…' : 'Assign'}
          </button>
        )}

        <button type="button" onClick={onClear} disabled={busy} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto',
        }}>
          Clear selection
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreateAndAssign} style={{
          borderTop: '1px solid #F1F5F9', paddingTop: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          <div>
            <label style={labelStyle}>First name</label>
            <input required autoComplete="off" placeholder="Sarah" style={inputStyle}
              value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input required autoComplete="off" placeholder="Jones" style={inputStyle}
              value={newLastName} onChange={e => setNewLastName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Role / position</label>
            <input autoComplete="off" placeholder="e.g. SENCO" style={inputStyle}
              value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Email address</label>
            <input required type="email" autoComplete="off" placeholder="colleague@school.org" style={inputStyle}
              value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowNewForm(false); setError(null) }} disabled={busy} style={{
              padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: 8,
              background: '#fff', color: '#475569',
              fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={{
              padding: '7px 16px', border: 'none', borderRadius: 8,
              background: busy ? '#94a3b8' : '#1B365D', color: '#fff',
              fontSize: '0.82rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {busy ? 'Creating…' : 'Create & assign'}
            </button>
          </div>
        </form>
      )}

      {error && <p style={{ fontSize: '0.78rem', color: '#dc2626', margin: 0 }}>{error}</p>}
    </div>
  )
}

function ByPointView({ schoolId, currentUserId, matId, supabase, readOnly }) {
  const [provisionPoints, setProvisionPoints] = useState([])
  const [assignments, setAssignments] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())

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
        .select('id, first_name, last_name, job_title')
        .eq('school_id', schoolId)
        .neq('id', currentUserId),
    ])

    const byId = {}
    for (const p of profileRes.data ?? []) byId[p.id] = p

    setProvisionPoints(ppRes.data ?? [])
    setAssignments(assignRes.data ?? [])
    setProfilesById(byId)
    setMembers(profileRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [schoolId, currentUserId, supabase])

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

  function toggleSelect(ppId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(ppId)) next.delete(ppId)
      else next.add(ppId)
      return next
    })
  }

  function toggleCategory(ids, allSelected) {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }

  async function handleBulkDone() {
    setSelected(new Set())
    await load()
  }

  function PointList({ points, showOwner, selectable }) {
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
              display: 'flex', alignItems: 'center',
            }}>
              {selectable && (
                <CategorySelectAllCheckbox points={pts} selected={selected} onToggleCategory={toggleCategory} />
              )}
              {cat} <span style={{ fontWeight: 400, marginLeft: 4 }}>({pts.length})</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pts.map(pp => {
                const ownerId = assigneeMap[pp.id]
                const owner = ownerId ? profilesById[ownerId] : null
                return (
                  <div key={pp.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    background: selectable && selected.has(pp.id) ? 'rgba(27,54,93,0.08)' : '#F7F8FA', gap: 12,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 10 }}>
                      {selectable && (
                        <input type="checkbox" checked={selected.has(pp.id)} onChange={() => toggleSelect(pp.id)}
                          style={{ accentColor: '#1B365D', cursor: 'pointer', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.82rem', color: '#334155' }}>
                        {pp.label}
                      </span>
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
          : <PointList points={unassigned} showOwner={false} selectable={!readOnly} />
        }
      </div>

      <div style={{ height: '1px', background: '#E2E8F0' }} />

      <div>
        {sectionHead('Assigned', assigned.length, '#257A3B')}
        {assigned.length === 0
          ? <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No points have been assigned yet.</p>
          : <PointList points={assigned} showOwner={true} selectable={false} />
        }
      </div>

      {!readOnly && selected.size > 0 && (
        <BulkAssignBar
          selectedIds={selected}
          members={members}
          schoolId={schoolId}
          currentUserId={currentUserId}
          matId={matId}
          supabase={supabase}
          onDone={handleBulkDone}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}

// ── TeamPage ──────────────────────────────────────────────────────────

export default function TeamPage({ schoolId, currentUserId, matId, supabase, onInviteUser, readOnly = false, userRole }) {
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

      {/* Toggle + Invite */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <PillToggle
          options={[
            { value: 'person', label: 'By Person' },
            { value: 'point',  label: 'By Point'  },
          ]}
          value={view}
          onChange={setView}
        />
        {onInviteUser && !readOnly && (
          <button type="button" onClick={onInviteUser} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', border: '1px solid #1B365D', borderRadius: 8,
            background: '#fff', color: '#1B365D',
            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <i className="ti ti-user-plus" style={{ fontSize: '0.9rem' }} />
            Invite user
          </button>
        )}
      </div>

      {/* View */}
      {view === 'person' && (
        <ByPersonView
          schoolId={schoolId}
          currentUserId={currentUserId}
          supabase={supabase}
          readOnly={readOnly}
          userRole={userRole}
          onInviteUser={onInviteUser}
        />
      )}
      {view === 'point' && (
        <ByPointView
          schoolId={schoolId}
          currentUserId={currentUserId}
          matId={matId}
          supabase={supabase}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
