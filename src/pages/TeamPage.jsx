import { useEffect, useState } from 'react'
import AssignmentModal, { CATEGORY_ORDER } from '../components/AssignmentModal'

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

function ByPersonView({ schoolId, currentUserId, supabase }) {
  const [members, setMembers] = useState([])
  const [assignmentCounts, setAssignmentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalPerson, setModalPerson] = useState(null)

  async function loadData() {
    setLoading(true)

    const { data: profileData, error: pErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, job_title')
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

export default function TeamPage({ schoolId, currentUserId, supabase, onInviteUser }) {
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
        {onInviteUser && (
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
