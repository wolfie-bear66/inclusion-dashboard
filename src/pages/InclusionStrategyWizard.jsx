import { useEffect, useRef, useState } from 'react'
import { generateInclusionStrategyDraft } from '../generateReport'

// ── Constants ─────────────────────────────────────────────────────────
const NAVY   = '#1B365D'
const BORDER = '#E2E8F0'

const DFE_PRINCIPLES = [
  'Leadership & Governance',
  'Early & Evidence-Based Support',
  'High Quality Adaptive Teaching',
  'Enriching Provision',
  'Safe & Respectful Culture',
  'Family & Wider Partnerships',
  'Accessible & Inclusive Environments',
]

const FUNDING_OPTIONS = [
  { value: 'pupil_premium',             label: 'Pupil Premium' },
  { value: 'send_budget',               label: 'SEND Budget' },
  { value: 'inclusive_mainstream_fund', label: 'Inclusive Mainstream Fund' },
  { value: 'sport_premium',             label: 'Sport Premium' },
  { value: 'school_general_budget',     label: 'School General Budget' },
]
const FUNDING_LABELS = Object.fromEntries(FUNDING_OPTIONS.map(f => [f.value, f.label]))

const STEP_LABELS = [
  'Setup',
  'Barriers',
  'Priorities & Activity',
  'Statement of Intent',
  'Intended Outcomes',
  'Further Information',
]

const OUTCOME_PROMPTS = [
  'By the end of this strategy, we want to see…',
  'Pupils will be able to…',
  'Families and staff will notice…',
]

function defaultAcademicYearLabel() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() // 0-indexed, Aug = 7
  return m >= 7 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`
}

const inp = {
  padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 7,
  fontSize: '0.83rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
const labelStyle = { fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: 5, display: 'block' }
const cardStyle = {
  background: '#FFFFFF', borderRadius: 14, border: `1px solid ${BORDER}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', padding: 22,
}
const primaryBtn = {
  padding: '9px 18px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff',
  fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const ghostBtn = {
  padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: '#334155',
  fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const smallBtn = {
  padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: '#334155',
  fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

// ── Step indicator ────────────────────────────────────────────────────
function StepIndicator({ step, maxVisited, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const visited = n <= maxVisited
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              disabled={!visited}
              onClick={() => visited && onJump(n)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: 'none', background: 'transparent', cursor: visited ? 'pointer' : 'default',
                padding: '4px 6px', fontFamily: 'inherit',
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700,
                background: active ? NAVY : visited ? 'rgba(27,54,93,0.12)' : '#F0F2F5',
                color: active ? '#fff' : visited ? NAVY : '#94a3b8',
              }}>{n}</span>
              <span style={{
                fontSize: '0.74rem', fontWeight: active ? 700 : 500,
                color: active ? NAVY : visited ? '#334155' : '#94a3b8',
                whiteSpace: 'nowrap',
              }}>{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <span style={{ width: 14, height: 1, background: BORDER, flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SaveIndicator({ status }) {
  if (status === 'idle') return null
  const label = status === 'saving' ? 'Saving…' : 'Saved'
  const colour = status === 'saving' ? '#94a3b8' : '#257A3B'
  return <span style={{ fontSize: '0.72rem', color: colour, fontWeight: 500 }}>{label}</span>
}

// ── Step 1: Setup ─────────────────────────────────────────────────────
function Step1Setup({ form, setField }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Setup</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 18 }}>
        Basic details for this year's Inclusion Strategy statement.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
        <div>
          <label style={labelStyle}>Academic year label</label>
          <input type="text" style={inp} value={form.academic_year_label ?? ''}
            placeholder="e.g. 2026/27"
            onChange={e => setField('academic_year_label', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Review date</label>
          <input type="date" style={inp} value={form.review_date ?? ''}
            onChange={e => setField('review_date', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Authorised by</label>
          <input type="text" style={inp} value={form.authorised_by ?? ''}
            placeholder="Name of the person authorising this statement"
            onChange={e => setField('authorised_by', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

function SelectAllRow({ barriers, barrierIds, onSelectAll }) {
  const checkboxRef = useRef(null)
  const selectedCount = barriers.filter(b => barrierIds.includes(b.id)).length
  const allChecked = selectedCount === barriers.length
  const someChecked = selectedCount > 0 && !allChecked

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someChecked
  }, [someChecked])

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
      <input ref={checkboxRef} type="checkbox" checked={allChecked}
        onChange={e => onSelectAll(e.target.checked)} style={{ cursor: 'pointer' }} />
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
        Select all ({selectedCount} of {barriers.length} selected)
      </span>
    </label>
  )
}

// ── Step 2: Barriers ──────────────────────────────────────────────────
function Step2Barriers({ school, supabase: sb, domains, barrierIds, toggleBarrier, onSelectAll, barriers, setBarriers }) {
  const [addOpen,   setAddOpen]   = useState(false)
  const [addForm,   setAddForm]   = useState({ description: '', domain_id: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [editForm,  setEditForm]  = useState({})
  const [editSaving,setEditSaving]= useState(false)

  function startEdit(b) {
    setEditId(b.id)
    setEditForm({ description: b.description, domain_id: b.domain_id, status: b.status })
  }

  async function saveEdit() {
    if (!editForm.description?.trim() || !editForm.domain_id) return
    setEditSaving(true)
    const payload = { description: editForm.description.trim(), domain_id: editForm.domain_id, status: editForm.status }
    const { error } = await sb.from('barriers').update(payload).eq('id', editId)
    if (!error) {
      setBarriers(prev => prev.map(b => b.id === editId
        ? { ...b, ...payload, domains: domains.find(d => d.id === payload.domain_id) ?? b.domains }
        : b))
      setEditId(null)
    }
    setEditSaving(false)
  }

  async function addBarrier() {
    if (!addForm.description.trim() || !addForm.domain_id) return
    setAddSaving(true)
    const { data, error } = await sb.from('barriers').insert({
      school_id: school,
      description: addForm.description.trim(),
      domain_id: addForm.domain_id,
      status: 'active',
      student_groups: {},
    }).select('id, description, domain_id, status, domains(id, name)').single()
    if (!error && data) {
      setBarriers(prev => [data, ...prev])
      toggleBarrier(data.id, true)
      setAddForm({ description: '', domain_id: '' })
      setAddOpen(false)
    }
    setAddSaving(false)
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Barriers to learning and participation</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
        Select which barriers this strategy addresses. You can edit an existing barrier or add a new one below.
      </p>

      {barriers.length === 0 && !addOpen && (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 12 }}>No barriers recorded yet — add one below.</p>
      )}

      {barriers.length > 0 && (
        <SelectAllRow barriers={barriers} barrierIds={barrierIds} onSelectAll={onSelectAll} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {barriers.map(b => {
          const checked = barrierIds.includes(b.id)
          const isEditing = editId === b.id
          if (isEditing) {
            return (
              <div key={b.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, background: '#F7F8FA' }}>
                <textarea rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 8 }}
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select style={{ ...inp, width: 'auto' }} value={editForm.domain_id}
                    onChange={e => setEditForm(prev => ({ ...prev, domain_id: e.target.value }))}>
                    <option value="">Select domain…</option>
                    {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select style={{ ...inp, width: 'auto' }} value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="being_addressed">Being addressed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={primaryBtn} disabled={editSaving} onClick={saveEdit}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" style={ghostBtn} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            )
          }
          return (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
              border: `1px solid ${checked ? NAVY : BORDER}`, borderRadius: 10,
              background: checked ? 'rgba(27,54,93,0.04)' : '#fff',
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggleBarrier(b.id, !checked)}
                style={{ marginTop: 3, cursor: 'pointer' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.84rem', color: '#1A202C' }}>{b.description}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  {b.domains?.name && (
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#E2E8F0', color: '#64748b', fontWeight: 500 }}>
                      {b.domains.name}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                    background: b.status === 'resolved' ? 'rgba(37,122,59,0.12)' : b.status === 'being_addressed' ? 'rgba(212,117,26,0.12)' : 'rgba(234,67,53,0.10)',
                    color: b.status === 'resolved' ? '#257A3B' : b.status === 'being_addressed' ? '#D4751A' : '#EA4335',
                  }}>{b.status === 'resolved' ? 'Resolved' : b.status === 'being_addressed' ? 'Being addressed' : 'Active'}</span>
                </div>
              </div>
              <button type="button" style={smallBtn} onClick={() => startEdit(b)}>Edit</button>
            </div>
          )
        })}
      </div>

      {addOpen ? (
        <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <textarea rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 8 }}
            placeholder="Describe the barrier to learning or participation"
            value={addForm.description}
            onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))} />
          <select style={{ ...inp, width: 'auto', marginBottom: 8 }} value={addForm.domain_id}
            onChange={e => setAddForm(prev => ({ ...prev, domain_id: e.target.value }))}>
            <option value="">Select domain…</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={primaryBtn} disabled={addSaving} onClick={addBarrier}>
              {addSaving ? 'Adding…' : 'Add barrier'}
            </button>
            <button type="button" style={ghostBtn} onClick={() => setAddOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" style={ghostBtn} onClick={() => setAddOpen(true)}>
          + Add new barrier
        </button>
      )}
    </div>
  )
}

// ── Step 3: Priorities & Activity ─────────────────────────────────────
function PriorityRow({ priority, onUpdate, onRemove }) {
  const [local, setLocal] = useState(priority)

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, background: '#F7F8FA', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <input type="text" style={{ ...inp, fontWeight: 600 }}
          value={local.point_description ?? ''}
          placeholder="Priority description"
          onChange={e => setLocal(prev => ({ ...prev, point_description: e.target.value }))}
          onBlur={e => onUpdate(priority.id, { point_description: e.target.value })} />
        <button type="button" style={{ ...smallBtn, flexShrink: 0 }} onClick={() => onRemove(priority.id)}>Remove</button>
      </div>
      <textarea rows={2} style={{ ...inp, resize: 'vertical' }}
        placeholder="What activity will happen this academic year?"
        value={local.activity_description ?? ''}
        onChange={e => setLocal(prev => ({ ...prev, activity_description: e.target.value }))}
        onBlur={e => onUpdate(priority.id, { activity_description: e.target.value })} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 140px' }}>
          <label style={{ ...labelStyle, fontSize: '0.7rem', marginBottom: 3 }}>Budgeted cost (£)</label>
          <input type="number" style={inp} value={local.budgeted_cost ?? ''}
            onChange={e => setLocal(prev => ({ ...prev, budgeted_cost: e.target.value }))}
            onBlur={e => onUpdate(priority.id, { budgeted_cost: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div style={{ flex: '0 0 220px' }}>
          <label style={{ ...labelStyle, fontSize: '0.7rem', marginBottom: 3 }}>Funding source</label>
          <select style={inp} value={local.funding_source ?? ''}
            onChange={e => { const v = e.target.value || null; setLocal(prev => ({ ...prev, funding_source: v })); onUpdate(priority.id, { funding_source: v }) }}>
            <option value="">None specified</option>
            {FUNDING_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function PrincipleSection({ principle, isOpen, onToggle, points, entryStatusMap, priorities, onAddFromPoint, onAddManual, onUpdatePriority, onRemovePriority }) {
  const addedSourceIds = new Set(priorities.filter(p => p.source_point_id).map(p => p.source_point_id))
  const withStatus = points.map(p => ({ ...p, _status: entryStatusMap[p.id] ?? 'none' }))
  const notStarted = withStatus.filter(p => p._status === 'none')
  const notInPlace = withStatus.filter(p => p._status === 'not_in_place')
  const inProgress = withStatus.filter(p => p._status === 'in_progress')
  const pool = (notStarted.length + notInPlace.length) > 0 ? [...notStarted, ...notInPlace] : inProgress
  const suggestions = pool.filter(p => !addedSourceIds.has(p.id))

  return (
    <div style={cardStyle}>
      <button type="button" onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', width: '100%', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left',
      }}>
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#1A202C' }}>{principle}</span>
        {priorities.length > 0 && (
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: NAVY, background: 'rgba(27,54,93,0.10)', padding: '2px 9px', borderRadius: 999, marginRight: 10 }}>
            {priorities.length} added
          </span>
        )}
        <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '0.85rem', color: '#94a3b8' }} />
      </button>

      {isOpen && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {suggestions.length > 0 && (
            <div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 8 }}>Suggested from provision gaps:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map(p => (
                  <button key={p.id} type="button" onClick={() => onAddFromPoint(p, principle)} style={{
                    padding: '6px 12px', borderRadius: 999, border: `1px solid ${NAVY}`, background: '#fff',
                    color: NAVY, fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    + {p.label}
                    <span style={{ marginLeft: 6, fontSize: '0.68rem', color: p._status === 'none' ? '#EA4335' : p._status === 'not_in_place' ? '#D4751A' : '#94a3b8' }}>
                      {p._status === 'none' ? '· not started' : p._status === 'not_in_place' ? '· not in place' : '· in progress'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {priorities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {priorities.map(p => (
                <PriorityRow key={p.id} priority={p} onUpdate={onUpdatePriority} onRemove={onRemovePriority} />
              ))}
            </div>
          )}

          <button type="button" style={ghostBtn} onClick={() => onAddManual(principle)}>
            + Add priority manually
          </button>
        </div>
      )}
    </div>
  )
}

function Step3Priorities({ provisionPoints, entryStatusMap, priorities, openPrinciples, togglePrinciple, onAddFromPoint, onAddManual, onUpdatePriority, onRemovePriority }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {DFE_PRINCIPLES.map(principle => (
        <PrincipleSection
          key={principle}
          principle={principle}
          isOpen={openPrinciples.has(principle)}
          onToggle={() => togglePrinciple(principle)}
          points={provisionPoints.filter(p => p.principle === principle)}
          entryStatusMap={entryStatusMap}
          priorities={priorities.filter(p => p.principle === principle)}
          onAddFromPoint={onAddFromPoint}
          onAddManual={onAddManual}
          onUpdatePriority={onUpdatePriority}
          onRemovePriority={onRemovePriority}
        />
      ))}
    </div>
  )
}

// ── Step 4: Statement of Intent ───────────────────────────────────────
function Step4Intent({ form, setField }) {
  const text = form.statement_of_intent ?? ''
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Statement of intent</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
        A short statement setting out your school's overall approach and commitment to inclusion.
      </p>
      <textarea rows={12} style={{ ...inp, resize: 'vertical' }}
        value={text} onChange={e => setField('statement_of_intent', e.target.value)} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: wordCount > 500 ? '#D4751A' : '#94a3b8' }}>
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
        {wordCount > 500 && (
          <span style={{ fontSize: '0.72rem', color: '#D4751A' }}>
            Over the suggested 500 words — consider tightening for a statutory statement.
          </span>
        )}
      </div>
    </div>
  )
}

// ── Step 5: Intended Outcomes ─────────────────────────────────────────
function Step5Outcomes({ form, setField }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Intended outcomes</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 12 }}>
        What do you want this strategy to achieve? Some prompts to help you get started:
      </p>
      <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
        {OUTCOME_PROMPTS.map(p => (
          <li key={p} style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4, fontStyle: 'italic' }}>{p}</li>
        ))}
      </ul>
      <textarea rows={10} style={{ ...inp, resize: 'vertical' }}
        value={form.intended_outcomes ?? ''} onChange={e => setField('intended_outcomes', e.target.value)} />
    </div>
  )
}

// ── Step 6: Further Information + Preview ─────────────────────────────
function Preview({ form, schoolName, barriers, priorities }) {
  const selectedBarriers = barriers.filter(b => form.barrier_ids?.includes(b.id))
  const byPrinciple = DFE_PRINCIPLES
    .map(principle => ({ principle, items: priorities.filter(p => p.principle === principle) }))
    .filter(g => g.items.length > 0)

  return (
    <div style={{ ...cardStyle, background: '#F7F8FA' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
        Preview
      </p>

      <div style={{ background: '#fff', borderRadius: 10, padding: 20, border: `1px solid ${BORDER}` }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: NAVY, marginBottom: 2 }}>{schoolName || 'School'}</h2>
        <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: 2 }}>
          Inclusion Strategy {form.academic_year_label || ''}
        </p>
        <p style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
          {form.review_date ? `Review date: ${form.review_date}` : 'Review date not set'}
          {form.authorised_by ? ` · Authorised by: ${form.authorised_by}` : ''}
        </p>

        <hr style={{ margin: '16px 0', border: 'none', borderTop: `1px solid ${BORDER}` }} />

        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', marginBottom: 6 }}>Statement of intent</h3>
        <p style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
          {form.statement_of_intent || <em style={{ color: '#94a3b8' }}>Not yet written.</em>}
        </p>

        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', marginBottom: 6 }}>Barriers to learning and participation</h3>
        {selectedBarriers.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 16 }}>No barriers selected.</p>
        ) : (
          <ol style={{ margin: '0 0 16px', paddingLeft: 18 }}>
            {selectedBarriers.map(b => (
              <li key={b.id} style={{ fontSize: '0.8rem', color: '#334155', marginBottom: 4 }}>{b.description}</li>
            ))}
          </ol>
        )}

        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', marginBottom: 6 }}>Activity in this academic year</h3>
        {byPrinciple.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 16 }}>No priorities added yet.</p>
        ) : byPrinciple.map(g => (
          <div key={g.principle} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY, marginBottom: 4 }}>{g.principle}</p>
            {g.items.map(item => (
              <div key={item.id} style={{ fontSize: '0.8rem', color: '#334155', marginBottom: 6, paddingLeft: 10 }}>
                <strong>{item.point_description || 'Untitled priority'}</strong>
                {item.activity_description && <div style={{ color: '#64748b' }}>{item.activity_description}</div>}
                {(item.budgeted_cost || item.funding_source) && (
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {item.budgeted_cost ? `£${item.budgeted_cost}` : ''}
                    {item.budgeted_cost && item.funding_source ? ' · ' : ''}
                    {item.funding_source ? FUNDING_LABELS[item.funding_source] ?? item.funding_source : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', marginTop: 10, marginBottom: 6 }}>Intended outcomes</h3>
        <p style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'pre-wrap', marginBottom: form.further_information ? 16 : 0 }}>
          {form.intended_outcomes || <em style={{ color: '#94a3b8' }}>Not yet written.</em>}
        </p>

        {form.further_information && (
          <>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A202C', marginBottom: 6 }}>Further information</h3>
            <p style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'pre-wrap' }}>{form.further_information}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Step6FurtherAndPreview({ form, setField, schoolName, barriers, priorities }) {
  const [generating, setGenerating] = useState(false)

  function handleGeneratePdf() {
    setGenerating(true)
    try {
      const selectedBarriers = barriers.filter(b => form.barrier_ids?.includes(b.id))
      generateInclusionStrategyDraft({ schoolName, draft: form, barriers: selectedBarriers, priorities })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Further information</h3>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>Optional — anything else you want to include.</p>
        <textarea rows={5} style={{ ...inp, resize: 'vertical' }}
          value={form.further_information ?? ''} onChange={e => setField('further_information', e.target.value)} />
      </div>

      <Preview form={form} schoolName={schoolName} barriers={barriers} priorities={priorities} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" style={primaryBtn} disabled={generating} onClick={handleGeneratePdf}>
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────
export default function InclusionStrategyWizard({ school, schoolName, supabase: sb, domains }) {
  const [loading, setLoading]   = useState(true)
  const [draftId, setDraftId]   = useState(null)
  const [form, setForm]         = useState({})
  const [step, setStep]         = useState(1)
  const [maxVisited, setMaxVisited] = useState(1)
  const [saveStatus, setSaveStatus] = useState('idle')

  const [barriers, setBarriers] = useState([])
  const [provisionPoints, setProvisionPoints] = useState([])
  const [entryStatusMap, setEntryStatusMap]   = useState({})
  const [priorities, setPriorities] = useState([])
  const [openPrinciples, setOpenPrinciples] = useState(new Set([DFE_PRINCIPLES[0]]))

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!school) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [draftRes, barriersRes, ppRes, entriesRes, userRes] = await Promise.all([
        sb.from('inclusion_strategy_drafts').select('*').eq('school_id', school)
          .order('created_at', { ascending: false }).limit(1),
        sb.from('barriers').select('id, description, domain_id, status, domains(id, name)')
          .order('created_at', { ascending: false }),
        sb.from('provision_points').select('id, label, principle, display_order')
          .eq('active', true).order('display_order'),
        sb.from('entries').select('provision_point_id, status').eq('school_id', school),
        sb.auth.getUser(),
      ])

      if (cancelled) return

      let draft = draftRes.data?.[0] ?? null
      if (!draft) {
        let defaultAuthorisedBy = ''
        const userId = userRes.data?.user?.id
        if (userId) {
          const { data: profile } = await sb.from('profiles').select('first_name, last_name').eq('id', userId).single()
          if (profile) defaultAuthorisedBy = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        }
        const { data: created } = await sb.from('inclusion_strategy_drafts').insert({
          school_id: school,
          academic_year_label: defaultAcademicYearLabel(),
          authorised_by: defaultAuthorisedBy,
        }).select('*').single()
        draft = created
      }

      if (cancelled) return

      setDraftId(draft?.id ?? null)
      setForm({
        academic_year_label: draft?.academic_year_label ?? '',
        review_date: draft?.review_date ?? '',
        authorised_by: draft?.authorised_by ?? '',
        barrier_ids: draft?.barrier_ids ?? [],
        statement_of_intent: draft?.statement_of_intent ?? '',
        intended_outcomes: draft?.intended_outcomes ?? '',
        further_information: draft?.further_information ?? '',
      })
      setBarriers(barriersRes.data ?? [])
      setProvisionPoints(ppRes.data ?? [])

      const statusMap = {}
      for (const e of entriesRes.data ?? []) {
        if (e.status) statusMap[e.provision_point_id] = e.status
      }
      setEntryStatusMap(statusMap)

      if (draft?.id) {
        const { data: prioritiesData } = await sb.from('inclusion_strategy_priorities')
          .select('*').eq('strategy_id', draft.id).order('sort_order')
        if (!cancelled) setPriorities(prioritiesData ?? [])
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [school])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function persistDraft(fields) {
    if (!draftId) return
    setSaveStatus('saving')
    await sb.from('inclusion_strategy_drafts').update(fields).eq('id', draftId)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  async function goToStep(n) {
    // Autosave the free-text / setup fields on every step transition
    await persistDraft({
      academic_year_label: form.academic_year_label || null,
      review_date: form.review_date || null,
      authorised_by: form.authorised_by || null,
      statement_of_intent: form.statement_of_intent || null,
      intended_outcomes: form.intended_outcomes || null,
      further_information: form.further_information || null,
    })
    setStep(n)
    setMaxVisited(prev => Math.max(prev, n))
  }

  function toggleBarrier(barrierId, checked) {
    const next = checked
      ? [...new Set([...(form.barrier_ids ?? []), barrierId])]
      : (form.barrier_ids ?? []).filter(id => id !== barrierId)
    setField('barrier_ids', next)
    persistDraft({ barrier_ids: next })
  }

  function setAllBarriers(checked) {
    const next = checked ? barriers.map(b => b.id) : []
    setField('barrier_ids', next)
    persistDraft({ barrier_ids: next })
  }

  function togglePrinciple(principle) {
    setOpenPrinciples(prev => {
      const next = new Set(prev)
      if (next.has(principle)) next.delete(principle)
      else next.add(principle)
      return next
    })
  }

  async function addFromPoint(point, principle) {
    const count = priorities.filter(p => p.principle === principle).length
    const { data, error } = await sb.from('inclusion_strategy_priorities').insert({
      strategy_id: draftId,
      principle,
      source_point_id: point.id,
      point_description: point.label,
      sort_order: count,
    }).select('*').single()
    if (!error && data) setPriorities(prev => [...prev, data])
  }

  async function addManual(principle) {
    const count = priorities.filter(p => p.principle === principle).length
    const { data, error } = await sb.from('inclusion_strategy_priorities').insert({
      strategy_id: draftId,
      principle,
      point_description: '',
      sort_order: count,
    }).select('*').single()
    if (!error && data) setPriorities(prev => [...prev, data])
  }

  async function updatePriority(id, fields) {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p))
    await sb.from('inclusion_strategy_priorities').update(fields).eq('id', id)
  }

  async function removePriority(id) {
    setPriorities(prev => prev.filter(p => p.id !== id))
    await sb.from('inclusion_strategy_priorities').delete().eq('id', id)
  }

  if (loading) return <p className="state-msg">Loading…</p>

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A202C' }}>Create Inclusion Strategy</h1>
          <SaveIndicator status={saveStatus} />
        </div>
        <StepIndicator step={step} maxVisited={maxVisited} onJump={goToStep} />
      </div>

      {step === 1 && <Step1Setup form={form} setField={setField} />}
      {step === 2 && (
        <Step2Barriers school={school} supabase={sb} domains={domains}
          barrierIds={form.barrier_ids ?? []} toggleBarrier={toggleBarrier} onSelectAll={setAllBarriers}
          barriers={barriers} setBarriers={setBarriers} />
      )}
      {step === 3 && (
        <Step3Priorities
          provisionPoints={provisionPoints} entryStatusMap={entryStatusMap} priorities={priorities}
          openPrinciples={openPrinciples} togglePrinciple={togglePrinciple}
          onAddFromPoint={addFromPoint} onAddManual={addManual}
          onUpdatePriority={updatePriority} onRemovePriority={removePriority}
        />
      )}
      {step === 4 && <Step4Intent form={form} setField={setField} />}
      {step === 5 && <Step5Outcomes form={form} setField={setField} />}
      {step === 6 && (
        <Step6FurtherAndPreview form={form} setField={setField} schoolName={schoolName}
          barriers={barriers} priorities={priorities} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6 }}>
        <button type="button" style={ghostBtn} disabled={step === 1} onClick={() => goToStep(step - 1)}>
          Back
        </button>
        {step < 6 && (
          <button type="button" style={primaryBtn} onClick={() => goToStep(step + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}
