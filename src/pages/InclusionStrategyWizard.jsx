import { useEffect, useRef, useState } from 'react'
import { generateStrategyWord } from '../generateStrategyWord'
import { tags as barrierTags, activityState as barrierActivityState } from '../utils/barrierTags'
import { saveBarrier } from '../utils/barrierSave'
import { computeCounts } from '../utils/computeCounts'
import BarrierForm from '../components/BarrierForm'
import StatusBar from '../components/StatusBar'
import { BARRIER_SELECT } from '../constants/barriers'
import { PRINCIPLE_LABEL_SHORT } from '../constants/principles'

// One in-flight creation promise per school, shared across mounts/remounts of this component
// within the same tab. inclusion_strategy_drafts.school_id has no unique constraint, so two
// concurrent "no draft yet" loads (e.g. a fast remount via "Update my dashboard" then straight
// back in) would otherwise both insert and silently duplicate the draft. The second caller
// awaits the first's insert instead of starting its own.
const draftCreationLocks = new Map()

// ── Constants ─────────────────────────────────────────────────────────
const NAVY   = '#1B365D'
const BORDER = '#E2E8F0'

const STEP_LABELS = [
  'Details',
  'Where you are',
  'Barriers and activity',
  'Outcomes',
  'Statement of intent',
  'Review and more',
  'Preview and Word',
]

const UNIVERSAL_OR_TARGETED_OPTIONS = [
  { value: 'universal', label: 'Universal' },
  { value: 'targeted',  label: 'Targeted' },
]

function defaultAcademicYearLabel() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() // 0-indexed, Sep = 8
  return m >= 8 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`
}

// A priority (activity) belongs in the "Unlinked activities" tray when it has zero barrier
// links AND carries real content — from either the new barrier-first flow (point_description)
// or a pre-migration row (activity_description / budgeted_cost / funding_source). A bare,
// content-free stub stays invisible either way. Any count shown anywhere uses this same rule.
function isTrayEligible(priority, linkedBarrierIds) {
  if ((linkedBarrierIds ?? []).length > 0) return false
  const hasText    = !!(priority.point_description?.trim() || priority.activity_description?.trim())
  const hasCost    = priority.budgeted_cost != null && Number(priority.budgeted_cost) > 0
  const hasFunding = !!priority.funding_source
  // A new-model activity (addManualActivity / addSuggestedActivity) always sets this, even in
  // the edge case where its point_description is later blanked out — so a barrier-first row
  // that's lost all its links still surfaces instead of silently vanishing from the tray.
  const hasType    = priority.universal_or_targeted != null
  return hasText || hasCost || hasFunding || hasType
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

// ── Step 1: Details ──────────────────────────────────────────────────
function Step1Details({ form, setField, readOnly, onBlurSave }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Details</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 18 }}>
        Basic details for this year's Inclusion Strategy statement.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
        <div>
          <label style={labelStyle}>Academic year label</label>
          <input type="text" style={inp} value={form.academic_year_label ?? ''} disabled={readOnly}
            placeholder="e.g. 2026/27"
            onChange={e => setField('academic_year_label', e.target.value)}
            onBlur={onBlurSave} />
        </div>
        <div>
          <label style={labelStyle}>Review date</label>
          <input type="date" style={inp} value={form.review_date ?? ''} disabled={readOnly}
            onChange={e => setField('review_date', e.target.value)}
            onBlur={onBlurSave} />
        </div>
        <div>
          <label style={labelStyle}>Authorised by</label>
          <input type="text" style={inp} value={form.authorised_by ?? ''} disabled={readOnly}
            placeholder="Name of the person authorising this statement"
            onChange={e => setField('authorised_by', e.target.value)}
            onBlur={onBlurSave} />
        </div>
      </div>
    </div>
  )
}

function ComingSoonStep({ title, note }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
        {note || 'This step is being rebuilt and will be added in the next update. Nothing here is lost — carry on to the other steps.'}
      </p>
    </div>
  )
}

// ── Step 2: Where you are ────────────────────────────────────────────
// All numbers here come from provisionPoints + allEntries, already fetched school-scoped by
// the wizard's own load effect — no new queries. Never reads inclusion_strategy_priorities
// .principle, which is a separate, often-null field on activity rows, not a progress source.
function Step2WhereYouAre({ provisionPoints, allEntries, onUpdateDashboard }) {
  const [selectedPrinciple, setSelectedPrinciple] = useState(null)

  const statusByPointId = {}
  for (const e of allEntries) statusByPointId[e.provision_point_id] = e.status

  const overall = computeCounts(provisionPoints, statusByPointId)
  const pctInPlace    = overall.total ? Math.round((overall.inPlace / overall.total) * 100) : 0
  const pctNotStarted = overall.total ? Math.round((overall.notStarted / overall.total) * 100) : 0

  const principles = Object.keys(PRINCIPLE_LABEL_SHORT)
  const principlePoints = selectedPrinciple
    ? provisionPoints.filter(pp => pp.principle === selectedPrinciple)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'rgba(217,154,27,0.10)', border: '1px solid rgba(217,154,27,0.35)', borderRadius: 10,
        padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <p style={{ fontSize: '0.8rem', color: '#7A5209', lineHeight: 1.5, margin: 0, flex: 1, minWidth: 240 }}>
          Your strategy will be more useful once your dashboard is up to date. Right now {pctInPlace}% of your points are
          in place and {pctNotStarted}% haven't been started. You can carry on and get a "story so far" draft, or update
          the dashboard first. Nothing here is locked.
        </p>
        {onUpdateDashboard && (
          <button type="button" style={ghostBtn} onClick={onUpdateDashboard}>Update my dashboard</button>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Where you are</h3>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 18 }}>
          Progress by DfE principle. Select a principle to see its points.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {principles.map(principle => {
            const counts = computeCounts(provisionPoints, statusByPointId, pp => pp.principle === principle)
            const active = selectedPrinciple === principle
            return (
              <button key={principle} type="button"
                onClick={() => setSelectedPrinciple(active ? null : principle)}
                style={{
                  textAlign: 'left', border: `1px solid ${active ? NAVY : BORDER}`, borderRadius: 10,
                  padding: 12, background: active ? 'rgba(27,54,93,0.04)' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A202C', marginBottom: 6 }}>
                  {PRINCIPLE_LABEL_SHORT[principle] ?? principle}
                </div>
                <StatusBar counts={counts} />
              </button>
            )
          })}
        </div>
      </div>

      {selectedPrinciple && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1A202C', marginBottom: 12 }}>
            {PRINCIPLE_LABEL_SHORT[selectedPrinciple] ?? selectedPrinciple}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {principlePoints.map(pp => {
              const status = statusByPointId[pp.id]
              const style = POINT_STATUS_STYLE[status] ?? { bg: 'rgba(184,190,199,0.18)', fg: '#64748b', label: 'Not Started' }
              return (
                <div key={pp.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '7px 0', borderBottom: `1px solid ${BORDER}`,
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#334155' }}>{pp.label}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: 999, flexShrink: 0,
                    background: style.bg, color: style.fg,
                  }}>
                    {style.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Outcomes ──────────────────────────────────────────────────
// No outcome row is ever auto-created — dashboard data informs this step only through the
// read-only barrier summary and the placeholder wording below, never by writing into the DB.
function Step4Outcomes({ outcomes, selectedBarriers, onFieldChange, onBlurSave, onDelete, onAdd, readOnly }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Intended outcomes</h3>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8 }}>
        What outcomes are you aiming for from this year's activity, and how will you know you've achieved them?
      </p>
      {selectedBarriers.length > 0 && (
        <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 18, fontStyle: 'italic' }}>
          This strategy's barriers: {selectedBarriers.map(b => b.description).join('; ')}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {outcomes.map(row => (
          <div key={row.__localId} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
            <label style={labelStyle}>Outcome</label>
            <textarea rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} disabled={readOnly}
              value={row.outcome ?? ''} onChange={e => onFieldChange(row.__localId, 'outcome', e.target.value)}
              onBlur={() => onBlurSave(row.__localId)}
              placeholder="e.g. Reduce persistent absence for our PP cohort" />
            <label style={labelStyle}>Success criteria</label>
            <textarea rows={2} style={{ ...inp, resize: 'vertical' }} disabled={readOnly}
              value={row.success_criteria ?? ''} onChange={e => onFieldChange(row.__localId, 'success_criteria', e.target.value)}
              onBlur={() => onBlurSave(row.__localId)}
              placeholder="e.g. Attendance for this group rises by 3 percentage points by July" />
            {!readOnly && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button type="button" style={smallBtn} onClick={() => onDelete(row.__localId)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button type="button" style={{ ...ghostBtn, marginTop: 12 }} onClick={onAdd}>+ Add outcome</button>
      )}
    </div>
  )
}

// ── Step 3: Barriers and activity ────────────────────────────────────
function PointRow({ label, statusLabel, statusColour, universalOrTargeted, trailing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#F7F8FA', borderRadius: 7 }}>
      <span style={{ flex: 1, fontSize: '0.8rem', color: '#1A202C' }}>{label}</span>
      {universalOrTargeted && (
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>
          {universalOrTargeted === 'universal' ? 'Universal' : universalOrTargeted === 'targeted' ? 'Targeted' : ''}
        </span>
      )}
      {statusLabel && (
        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: statusColour?.bg, color: statusColour?.fg }}>
          {statusLabel}
        </span>
      )}
      {trailing}
    </div>
  )
}

const POINT_STATUS_STYLE = {
  in_place:     { bg: 'rgba(47,133,90,0.12)',  fg: '#2F855A', label: 'In Place' },
  in_progress:  { bg: 'rgba(217,154,27,0.12)', fg: '#D99A1B', label: 'In Progress' },
  not_in_place: { bg: 'rgba(192,57,43,0.12)',  fg: '#C0392B', label: 'Not in Place' },
}

function BarrierActivityCard({
  barrier, number, entryStatusByPP, plannedActivities, barrierNote, onNoteChange,
  onTickSuggestion, onAddManualActivity, onRemoveActivityLink, onRemoveFromStrategy,
  allSelectedBarriers, readOnly,
}) {
  const [manualText, setManualText]   = useState('')
  const [manualType, setManualType]   = useState('')
  const [manualBarrierIds, setManualBarrierIds] = useState(() => new Set([barrier.id]))
  const [adding, setAdding] = useState(false)

  const dTags = barrierTags(barrier)
  const activity = barrierActivityState(barrier, [])
  // activityState needs { school_id, provision_point_id, status } rows; entryStatusByPP
  // already gives us status per point for this school, so derive has/no-activity locally
  // from the linked points themselves rather than re-fetching entries here.
  const links = (barrier.barrier_provision_points ?? []).filter(l => l.provision_points?.active !== false)
  const withStatus = links.map(l => ({ ...l, status: entryStatusByPP.get(l.provision_point_id) }))
  const hasActivityPoints = withStatus.filter(l => l.status === 'in_place' || l.status === 'in_progress')
  const gapPoints = withStatus.filter(l => l.status !== 'in_place' && l.status !== 'in_progress')
  const isNoActivity = hasActivityPoints.length === 0
  void activity // barrierActivityState needs real entries; hasActivityPoints above is the authoritative local check

  function toggleManualBarrier(id) {
    setManualBarrierIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submitManual() {
    if (!manualText.trim() || !manualType || manualBarrierIds.size === 0) return
    setAdding(true)
    await onAddManualActivity({ text: manualText.trim(), type: manualType, barrierIds: [...manualBarrierIds] })
    setManualText('')
    setManualType('')
    setManualBarrierIds(new Set([barrier.id]))
    setAdding(false)
  }

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', background: NAVY, color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{number}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.85rem', color: '#1A202C', lineHeight: 1.5, margin: 0 }}>{barrier.description}</p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {dTags.principles.map(p => (
                <span key={`p-${p}`} style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(91,33,182,0.09)', color: '#5B21B6' }}>
                  {PRINCIPLE_LABEL_SHORT[p] ?? p}
                </span>
              ))}
              {dTags.categories.map(c => (
                <span key={`c-${c}`} style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(30,64,175,0.09)', color: '#1E40AF' }}>{c}</span>
              ))}
              <span style={{
                fontSize: '0.66rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                background: isNoActivity ? 'rgba(184,190,199,0.25)' : 'rgba(47,133,90,0.12)',
                color: isNoActivity ? '#6B7280' : '#2F855A',
              }}>{isNoActivity ? 'No activity yet' : 'Has activity'}</span>
            </div>
          </div>
          {!readOnly && (
            <button type="button" onClick={() => onRemoveFromStrategy(barrier.id)} style={smallBtn}>Remove</button>
          )}
        </div>

        {!isNoActivity && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Existing provision
            </p>
            {hasActivityPoints.map(l => (
              <PointRow key={l.provision_point_id}
                label={l.provision_points?.label ?? 'Untitled'}
                universalOrTargeted={l.provision_points?.universal_or_targeted}
                statusLabel={POINT_STATUS_STYLE[l.status]?.label}
                statusColour={POINT_STATUS_STYLE[l.status]} />
            ))}
          </div>
        )}

        {/* Available regardless of activity state — a barrier can have a recurring trend/theme
            worth noting in the Word export whether or not it currently has activity against it. */}
        <div>
          <label style={{ ...labelStyle, fontSize: '0.72rem' }}>Trend or theme over time (optional)</label>
          <textarea rows={2} style={{ ...inp, resize: 'vertical' }} disabled={readOnly}
            defaultValue={barrierNote ?? ''}
            onBlur={e => onNoteChange(barrier.id, e.target.value)}
            placeholder="e.g. this has recurred across the last two academic years" />
        </div>

        {isNoActivity && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {plannedActivities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Planned activity
                </p>
                {plannedActivities.map(p => (
                  <PointRow key={p.id}
                    label={p.point_description || 'Untitled activity'}
                    universalOrTargeted={p.universal_or_targeted}
                    trailing={!readOnly && (
                      <button type="button" onClick={() => onRemoveActivityLink(p.id, barrier.id)} style={{ ...smallBtn, padding: '3px 8px' }}>Remove</button>
                    )} />
                ))}
              </div>
            )}

            {gapPoints.length > 0 && !readOnly && (
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                  Suggestions from linked provision gaps
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {gapPoints.map(l => (
                    <button key={l.provision_point_id} type="button"
                      onClick={() => onTickSuggestion(l.provision_points, barrier.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 999, border: `1px solid ${NAVY}`, background: '#fff',
                        color: NAVY, fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      + {l.provision_points?.label ?? 'Untitled'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!readOnly && (
              <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
                  Describe a new activity
                </p>
                <textarea rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 8 }}
                  value={manualText} onChange={e => setManualText(e.target.value)}
                  placeholder="What will you do?" />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select style={{ ...inp, width: 'auto' }} value={manualType} onChange={e => setManualType(e.target.value)}>
                    <option value="">Choose…</option>
                    {UNIVERSAL_OR_TARGETED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {allSelectedBarriers.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Also addresses:</span>
                      {allSelectedBarriers.filter(b => b.id !== barrier.id).map((b, i) => (
                        <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#374151', cursor: 'pointer' }}>
                          <input type="checkbox" checked={manualBarrierIds.has(b.id)} onChange={() => toggleManualBarrier(b.id)} />
                          #{b.__number ?? i + 2}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" style={primaryBtn} disabled={adding || !manualText.trim() || !manualType} onClick={submitManual}>
                  {adding ? 'Adding…' : 'Add activity'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TrayRow({ priority, barrierOptions, onLink, readOnly }) {
  const [target, setTarget] = useState('')
  const [linking, setLinking] = useState(false)

  async function handleLink() {
    if (!target) return
    setLinking(true)
    await onLink(priority.id, target)
    setLinking(false)
  }

  const title = priority.point_description?.trim() || priority.activity_description?.trim() || 'Untitled activity'
  const costLabel = priority.budgeted_cost ? `£${Number(priority.budgeted_cost).toLocaleString('en-GB')}` : null

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.82rem', color: '#1A202C', margin: 0 }}>{title}</p>
        {priority.point_description && priority.activity_description && (
          <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '2px 0 0' }}>{priority.activity_description}</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.72rem', color: '#94a3b8' }}>
          {costLabel && <span>{costLabel}</span>}
          {priority.funding_source && <span>{priority.funding_source.replace(/_/g, ' ')}</span>}
        </div>
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <select style={{ ...inp, width: 'auto', fontSize: '0.76rem' }} value={target} onChange={e => setTarget(e.target.value)}>
            <option value="">Link to barrier…</option>
            {barrierOptions.map((b, i) => <option key={b.id} value={b.id}>#{i + 1}</option>)}
          </select>
          <button type="button" style={{ ...smallBtn, padding: '5px 10px' }} disabled={!target || linking} onClick={handleLink}>
            {linking ? '…' : 'Link'}
          </button>
        </div>
      )}
    </div>
  )
}

function Step3BarriersAndActivity({
  school, sb, domains, barriers, setBarriers, provisionPoints, allEntries,
  form, selectedBarrierIds, toggleBarrierSelected, updateBarrierNote,
  priorities, priorityToBarrierIds, barrierToPriorities,
  addSuggestedActivity, addManualActivity, removeActivityLink, linkTrayActivity,
  readOnly,
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ description: '' })
  const [addFormErrors, setAddFormErrors] = useState({})
  const [addSelectedLinks, setAddSelectedLinks] = useState(() => new Set())
  const [addNoneFit, setAddNoneFit] = useState(false)
  const [addNoneFitDomain, setAddNoneFitDomain] = useState('')
  const [addLinkSearch, setAddLinkSearch] = useState('')
  const [addShowMore, setAddShowMore] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addSaveError, setAddSaveError] = useState(null)

  const selectedBarriers = selectedBarrierIds
    .map(id => barriers.find(b => b.id === id))
    .filter(Boolean)
    .map((b, i) => ({ ...b, __number: i + 1 }))
  const unselectedBarriers = barriers.filter(b => !selectedBarrierIds.includes(b.id))

  const entryStatusByPP = (() => {
    const m = new Map()
    for (const e of allEntries) m.set(e.provision_point_id, e.status)
    return m
  })()

  const trayPriorities = priorities.filter(p => isTrayEligible(p, priorityToBarrierIds.get(p.id) ?? []))

  function openAddBarrier() {
    setAddForm({ description: '' })
    setAddFormErrors({})
    setAddSelectedLinks(new Set())
    setAddNoneFit(false)
    setAddNoneFitDomain('')
    setAddLinkSearch('')
    setAddShowMore(false)
    setAddSaveError(null)
    setAddOpen(true)
  }

  async function submitAddBarrier() {
    setAddSaving(true)
    setAddSaveError(null)
    const { barrierId, error, fieldErrors } = await saveBarrier({
      sb, school, editBarrier: null, form: addForm,
      selectedLinks: addSelectedLinks, noneFit: addNoneFit, noneFitDomain: addNoneFitDomain,
      provisionPoints,
    })
    if (fieldErrors) {
      setAddFormErrors(fieldErrors)
    } else if (error) {
      setAddSaveError(error)
    } else {
      const { data } = await sb.from('barriers').select(BARRIER_SELECT).eq('id', barrierId).eq('school_id', school).single()
      if (data) {
        setBarriers(prev => [data, ...prev])
        toggleBarrierSelected(data.id, true)
      }
      setAddOpen(false)
    }
    setAddSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Barriers and activity</h3>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
          Pick which barriers this strategy addresses, then record the activity that addresses each one.
        </p>

        {!readOnly && unselectedBarriers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ ...labelStyle }}>This school's other recorded barriers</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unselectedBarriers.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: '#374151' }}>{b.description}</span>
                  <button type="button" style={smallBtn} onClick={() => toggleBarrierSelected(b.id, true)}>+ Add to strategy</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!readOnly && (
          addOpen ? (
            <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>New barrier description</label>
              </div>
              <BarrierForm
                form={addForm} setField={(k, v) => setAddForm(prev => ({ ...prev, [k]: v }))}
                formErrors={addFormErrors} setFormErrors={setAddFormErrors}
                noneFit={addNoneFit} toggleNoneFit={v => { setAddNoneFit(v); if (!v) setAddNoneFitDomain('') }}
                noneFitDomain={addNoneFitDomain} setNoneFitDomain={setAddNoneFitDomain}
                selectedLinks={addSelectedLinks}
                toggleLink={id => setAddSelectedLinks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                linkSearch={addLinkSearch} setLinkSearch={setAddLinkSearch}
                provisionPoints={provisionPoints} allEntries={allEntries} domainList={domains}
                showMore={addShowMore} setShowMore={setAddShowMore}
              />
              {addSaveError && <p style={{ fontSize: '0.78rem', color: '#DC2626', margin: '10px 0' }}>{addSaveError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" style={primaryBtn} disabled={addSaving} onClick={submitAddBarrier}>
                  {addSaving ? 'Adding…' : 'Add barrier'}
                </button>
                <button type="button" style={ghostBtn} onClick={() => setAddOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" style={ghostBtn} onClick={openAddBarrier}>+ Add new barrier</button>
          )
        )}
      </div>

      {selectedBarriers.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No barriers selected for this strategy yet.</p>
        </div>
      ) : selectedBarriers.map(b => (
        <BarrierActivityCard
          key={b.id}
          barrier={b}
          number={b.__number}
          entryStatusByPP={entryStatusByPP}
          plannedActivities={barrierToPriorities.get(b.id) ?? []}
          barrierNote={form.barrier_notes?.[b.id]}
          onNoteChange={updateBarrierNote}
          onTickSuggestion={addSuggestedActivity}
          onAddManualActivity={({ text, type, barrierIds }) => addManualActivity({ text, type, barrierIds })}
          onRemoveActivityLink={removeActivityLink}
          onRemoveFromStrategy={id => toggleBarrierSelected(id, false)}
          allSelectedBarriers={selectedBarriers}
          readOnly={readOnly}
        />
      ))}

      {trayPriorities.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Unlinked activities</h3>
          <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 12 }}>
            Recorded previously but not linked to a barrier — link each to one of this strategy's barriers to include it, or leave it here.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trayPriorities.map(p => (
              <TrayRow key={p.id} priority={p} barrierOptions={selectedBarriers} onLink={linkTrayActivity} readOnly={readOnly} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step "Preview and Word" ──────────────────────────────────────────
function Step7PreviewAndWord({ form, selectedBarriers, barrierToPriorities, entryStatusByPP, schoolName, readOnly, outcomes }) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  const outcomeRows = outcomes
    .filter(o => o.outcome?.trim() || o.success_criteria?.trim())
    .map(o => ({ outcome: o.outcome, successCriteria: o.success_criteria }))

  const activityRows = []
  const emptyBarrierRows = []
  const seenPointIds = new Map() // pointId -> row index, for dedupe across barriers

  for (const b of selectedBarriers) {
    const links = (b.barrier_provision_points ?? []).filter(l => l.provision_points?.active !== false)
    const hasActivityLinks = links.filter(l => {
      const s = entryStatusByPP.get(l.provision_point_id)
      return s === 'in_place' || s === 'in_progress'
    })
    const planned = barrierToPriorities.get(b.id) ?? []

    for (const l of hasActivityLinks) {
      const pp = l.provision_points
      if (seenPointIds.has(pp.id)) {
        activityRows[seenPointIds.get(pp.id)].barrierNumbers.push(b.__number)
      } else {
        seenPointIds.set(pp.id, activityRows.length)
        activityRows.push({ description: pp.label ?? 'Untitled', universalOrTargeted: pp.universal_or_targeted, barrierNumbers: [b.__number] })
      }
    }
    for (const p of planned) {
      const existing = activityRows.find(r => r.__priorityId === p.id)
      if (existing) {
        existing.barrierNumbers.push(b.__number)
      } else {
        activityRows.push({ __priorityId: p.id, description: p.point_description || 'Untitled activity', universalOrTargeted: p.universal_or_targeted, barrierNumbers: [b.__number] })
      }
    }
    if (hasActivityLinks.length === 0 && planned.length === 0) {
      emptyBarrierRows.push(b.__number)
    }
  }

  const checklist = [
    { label: 'Details', done: !!(form.academic_year_label && form.review_date && form.authorised_by?.trim()) },
    { label: 'Barriers', done: selectedBarriers.length > 0 },
    { label: 'Activity', done: activityRows.length > 0 },
    { label: 'Outcomes', done: outcomeRows.length > 0 },
    { label: 'Statement of intent', done: !!form.statement_of_intent?.trim() },
    { label: 'Further information', done: true },
  ]

  async function handleDownloadWord() {
    setGenerating(true)
    setGenError(null)
    try {
      await generateStrategyWord({
        schoolName,
        academicYearLabel: form.academic_year_label,
        reviewDate: form.review_date,
        authorisedBy: form.authorised_by,
        statementOfIntent: form.statement_of_intent,
        barrierRows: selectedBarriers.map(b => ({ number: b.__number, description: b.description, trendNote: form.barrier_notes?.[b.id] })),
        activityRows,
        emptyBarrierRows,
        outcomeRows,
        previousYearReview: form.previous_year_review,
        furtherInformation: form.further_information,
      })
    } catch (err) {
      console.error('[InclusionStrategyWizard] Word generation error:', err)
      setGenError('Could not generate the Word document — check console for details.')
    }
    setGenerating(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 12 }}>Preview and Word</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {checklist.map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <i className={`ti ${c.done ? 'ti-circle-check' : 'ti-circle-dashed'}`} style={{ color: c.done ? '#2F855A' : '#94a3b8' }} />
              <span style={{ color: c.done ? '#1A202C' : '#94a3b8' }}>{c.label}</span>
              {!c.done && <span style={{ fontSize: '0.72rem', color: '#B8BEC7' }}>[To complete]</span>}
            </div>
          ))}
        </div>
        {genError && <p style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: 10 }}>{genError}</p>}
        <button type="button" style={primaryBtn} disabled={generating || readOnly} onClick={handleDownloadWord}>
          {generating ? 'Generating…' : 'Download Word'}
        </button>
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────
export default function InclusionStrategyWizard({ school, schoolName, supabase: sb, domains, readOnly = false, onUpdateDashboard }) {
  const [loading, setLoading]   = useState(true)
  const [draftId, setDraftId]   = useState(null)
  const [form, setForm]         = useState({})
  const [step, setStep]         = useState(1)
  const [maxVisited, setMaxVisited] = useState(1)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState(null)
  const [draftCreateError, setDraftCreateError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const [barriers, setBarriers] = useState([])
  const [provisionPoints, setProvisionPoints] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [priorities, setPriorities] = useState([])
  const [priorityLinks, setPriorityLinks] = useState([]) // [{ id, priority_id, barrier_id }]
  const [outcomes, setOutcomes] = useState([]) // [{ id, outcome, success_criteria, sort_order }]

  const barriersFetchOk = useRef(false)
  // Serialises every write to inclusion_strategy_drafts through one promise chain, so a slow
  // write started earlier can never resolve after (and overwrite) a faster one started later —
  // each persistDraft call only actually hits the network once the previous one has finished.
  const persistQueueRef = useRef(Promise.resolve())

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!school) return
    let cancelled = false
    barriersFetchOk.current = false

    async function load() {
      setLoading(true)
      setDraftCreateError(false)

      const [draftRes, barriersRes, ppRes, entriesRes, userRes] = await Promise.all([
        sb.from('inclusion_strategy_drafts').select('*').eq('school_id', school)
          .order('created_at', { ascending: false }).limit(1),
        sb.from('barriers').select(BARRIER_SELECT).eq('school_id', school).order('created_at', { ascending: false }),
        sb.from('provision_points')
          .select('id, label, active, display_order, principle, category, universal_or_targeted, sub_domain_id, sub_domains(id, name, display_order, domain_id, domains(id, name, display_order))')
          .eq('active', true),
        sb.from('entries').select('provision_point_id, status, school_id').eq('school_id', school),
        sb.auth.getUser(),
      ])

      if (cancelled) return

      let draft = draftRes.data?.[0] ?? null
      let createError = null
      if (!draft && !readOnly) {
        // Create-once lock: a concurrent "no draft yet" load for this same school (e.g. a fast
        // remount) awaits this same insert instead of racing its own — see the module-level
        // draftCreationLocks comment for why that race matters here specifically. Resolves to
        // { draft, error } rather than just the row, so every awaiter (not only the one that
        // actually ran the insert) can tell a genuine creation failure apart from "not my
        // school" — readOnly already skips this block entirely for that case.
        if (!draftCreationLocks.has(school)) {
          draftCreationLocks.set(school, (async () => {
            let defaultAuthorisedBy = ''
            const userId = userRes.data?.user?.id
            if (userId) {
              const { data: profile } = await sb.from('profiles').select('first_name, last_name').eq('id', userId).single()
              if (profile) defaultAuthorisedBy = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
            }
            const { data: created, error } = await sb.from('inclusion_strategy_drafts').insert({
              school_id: school,
              academic_year_label: defaultAcademicYearLabel(),
              authorised_by: defaultAuthorisedBy,
            }).select('*').single()
            return { draft: created, error }
          })().finally(() => draftCreationLocks.delete(school)))
        }
        const result = await draftCreationLocks.get(school)
        draft = result.draft
        createError = result.error
      }

      if (cancelled) return

      if (createError) {
        console.error('Draft create error:', createError)
        setDraftCreateError(true)
      }

      const sortedPoints = (ppRes.data ?? []).slice().sort((a, b) =>
        (a.sub_domains?.domains?.display_order ?? 0) - (b.sub_domains?.domains?.display_order ?? 0) ||
        (a.sub_domains?.display_order ?? 0) - (b.sub_domains?.display_order ?? 0) ||
        (a.display_order ?? 0) - (b.display_order ?? 0)
      )

      const liveBarrierIds = new Set((barriersRes.data ?? []).map(b => b.id))
      // Prune stale ids (a deleted barrier's id lingering in a bare uuid[] with no FK) only
      // now that we know this fetch resolved successfully and is school-scoped — never on a
      // still-loading or errored fetch, so a slow/failed query can't wrongly strip valid ids.
      const rawBarrierIds = draft?.barrier_ids ?? []
      const prunedBarrierIds = barriersRes.error ? rawBarrierIds : rawBarrierIds.filter(id => liveBarrierIds.has(id))
      const rawNotes = draft?.barrier_notes ?? {}
      const prunedNotes = barriersRes.error ? rawNotes
        : Object.fromEntries(Object.entries(rawNotes).filter(([id]) => liveBarrierIds.has(id)))
      if (!barriersRes.error) barriersFetchOk.current = true

      setDraftId(draft?.id ?? null)
      setForm({
        academic_year_label: draft?.academic_year_label ?? '',
        review_date: draft?.review_date ?? '',
        authorised_by: draft?.authorised_by ?? '',
        barrier_ids: prunedBarrierIds,
        barrier_notes: prunedNotes,
        statement_of_intent: draft?.statement_of_intent ?? '',
        intended_outcomes: draft?.intended_outcomes ?? '',
        further_information: draft?.further_information ?? '',
        previous_year_review: draft?.previous_year_review ?? '',
      })
      setBarriers(barriersRes.data ?? [])
      setProvisionPoints(sortedPoints)
      setAllEntries(entriesRes.data ?? [])

      if (draft?.id) {
        const { data: prioritiesData } = await sb.from('inclusion_strategy_priorities')
          .select('*').eq('strategy_id', draft.id).order('sort_order')
        if (cancelled) return
        const priorityRows = prioritiesData ?? []
        setPriorities(priorityRows)

        const priorityIds = priorityRows.map(p => p.id)
        if (priorityIds.length > 0) {
          const { data: linkRows } = await sb.from('inclusion_strategy_priority_barriers')
            .select('id, priority_id, barrier_id').in('priority_id', priorityIds)
          if (!cancelled) setPriorityLinks(linkRows ?? [])
        } else {
          setPriorityLinks([])
        }

        const { data: outcomeRows } = await sb.from('inclusion_strategy_outcomes')
          .select('id, outcome, success_criteria, sort_order, created_at').eq('strategy_id', draft.id)
          .order('sort_order').order('created_at')
        if (!cancelled) setOutcomes((outcomeRows ?? []).map(o => ({ ...o, __localId: o.id })))
      } else {
        setPriorities([])
        setPriorityLinks([])
        setOutcomes([])
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [school, reloadToken])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Returns { ok, error } rather than throwing — every caller (goToStep, the blur handler,
  // "Update my dashboard") checks ok before doing anything that assumes the save landed, so a
  // write failure shows the error and blocks navigation instead of silently losing the edit.
  //
  // readOnly (viewing a school that isn't yours) is a quiet no-op, not a failure — App.jsx's
  // own read-only banner already covers that case above this component. But !draftId while NOT
  // readOnly only happens once loading has finished and the initial create failed (see
  // draftCreateError below), so that path is a real failure, not a silent no-op.
  //
  // Every call is chained onto persistQueueRef so writes hit the network in call order — a
  // slower write started earlier can't finish after (and stomp) a faster one started later.
  function persistDraft(fields) {
    const run = () => doPersist(fields)
    const result = persistQueueRef.current.then(run, run)
    persistQueueRef.current = result.catch(() => {})
    return result
  }

  async function doPersist(fields) {
    if (readOnly) return { ok: true }
    if (!draftId) return { ok: false, error: { message: 'no_draft' } }
    setSaveStatus('saving')
    setSaveError(null)
    // .select('id') so a write RLS silently matched zero rows against (stale id, row gone,
    // policy mismatch) is distinguishable from a real success — Postgres/PostgREST reports
    // that as HTTP 200 with an empty array, not an error, so it must be checked explicitly.
    const { data, error } = await sb.from('inclusion_strategy_drafts').update(fields).eq('id', draftId).select('id')
    if (error || !data || data.length === 0) {
      console.error('Draft save error:', error ?? 'zero rows updated')
      setSaveStatus('idle')
      setSaveError('Could not save your changes — please try again.')
      return { ok: false, error: error ?? { message: 'zero_rows_updated' } }
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
    return { ok: true }
  }

  function detailsAndTextFields() {
    return {
      academic_year_label: form.academic_year_label || null,
      review_date: form.review_date || null,
      authorised_by: form.authorised_by || null,
      statement_of_intent: form.statement_of_intent || null,
      further_information: form.further_information || null,
      previous_year_review: form.previous_year_review || null,
    }
  }

  async function goToStep(n) {
    const { ok } = await persistDraft(detailsAndTextFields())
    if (!ok) return
    setStep(n)
    setMaxVisited(prev => Math.max(prev, n))
  }

  async function handleUpdateDashboard() {
    const { ok } = await persistDraft(detailsAndTextFields())
    if (!ok) return
    onUpdateDashboard?.()
  }

  function retryCreateDraft() {
    setReloadToken(t => t + 1)
  }

  function toggleBarrierSelected(barrierId, checked) {
    if (readOnly) return
    const next = checked
      ? [...new Set([...(form.barrier_ids ?? []), barrierId])]
      : (form.barrier_ids ?? []).filter(id => id !== barrierId)
    setField('barrier_ids', next)
    persistDraft({ barrier_ids: next })
  }

  function updateBarrierNote(barrierId, text) {
    if (readOnly) return
    const next = { ...(form.barrier_notes ?? {}), [barrierId]: text }
    setField('barrier_notes', next)
    persistDraft({ barrier_notes: next })
  }

  // ── Outcomes (step 4) ────────────────────────────────────────────────
  // Per-row insert/update by id — never a delete-all/reinsert of the whole set, so one row's
  // edit can't disturb another's id or sort_order, and a failed write on one row never touches
  // the others. A row only gets its first INSERT once it has real content in either field; a
  // still-blank added row stays local-only. outcomeInsertLocksRef guards against a double
  // insert when both fields blur in close succession before the first insert has returned.
  const outcomeInsertLocksRef = useRef(new Map())

  function addOutcomeRow() {
    if (readOnly) return
    setOutcomes(prev => [...prev, { __localId: crypto.randomUUID(), id: null, outcome: '', success_criteria: '', sort_order: null }])
  }

  function updateOutcomeField(localId, field, value) {
    setOutcomes(prev => prev.map(o => (o.__localId === localId ? { ...o, [field]: value } : o)))
  }

  async function saveOutcomeRow(localId) {
    if (readOnly) return
    const row = outcomes.find(o => o.__localId === localId)
    if (!row) return
    const hasContent = !!(row.outcome?.trim() || row.success_criteria?.trim())

    if (!row.id) {
      if (!hasContent) return // still a blank added row — nothing to persist yet
      if (outcomeInsertLocksRef.current.has(localId)) {
        await outcomeInsertLocksRef.current.get(localId)
        return
      }
      const insertPromise = (async () => {
        const maxSort = outcomes.reduce((m, o) => (o.sort_order != null ? Math.max(m, o.sort_order) : m), -1)
        const { data, error } = await sb.from('inclusion_strategy_outcomes').insert({
          strategy_id: draftId,
          outcome: row.outcome?.trim() || '',
          success_criteria: row.success_criteria?.trim() || null,
          sort_order: maxSort + 1,
        }).select('id, outcome, success_criteria, sort_order, created_at').single()
        if (error || !data) {
          console.error('Outcome insert error:', error)
          setSaveError('Could not save this outcome — please try again.')
          return
        }
        setOutcomes(prev => prev.map(o => (o.__localId === localId ? { ...o, ...data, __localId: localId } : o)))
      })()
      outcomeInsertLocksRef.current.set(localId, insertPromise)
      await insertPromise
      outcomeInsertLocksRef.current.delete(localId)
      return
    }

    const { data, error } = await sb.from('inclusion_strategy_outcomes')
      .update({ outcome: row.outcome?.trim() || '', success_criteria: row.success_criteria?.trim() || null })
      .eq('id', row.id).select('id')
    if (error || !data || data.length === 0) {
      console.error('Outcome update error:', error ?? 'zero rows updated')
      setSaveError('Could not save this outcome — please try again.')
    }
  }

  async function deleteOutcomeRow(localId) {
    if (readOnly) return
    const row = outcomes.find(o => o.__localId === localId)
    if (!row) return
    const hasContent = !!(row.outcome?.trim() || row.success_criteria?.trim())
    if (hasContent && !window.confirm('Delete this outcome? This cannot be undone.')) return
    if (row.id) {
      const { error } = await sb.from('inclusion_strategy_outcomes').delete().eq('id', row.id)
      if (error) {
        console.error('Outcome delete error:', error)
        setSaveError('Could not delete this outcome — please try again.')
        return
      }
    }
    setOutcomes(prev => prev.filter(o => o.__localId !== localId))
  }

  async function addSuggestedActivity(point, barrierId) {
    if (readOnly || !point) return
    const count = priorities.length
    const { data, error } = await sb.from('inclusion_strategy_priorities').insert({
      strategy_id: draftId,
      principle: point.principle ?? null,
      source_point_id: point.id,
      point_description: point.label,
      universal_or_targeted: point.universal_or_targeted ?? null,
      sort_order: count,
    }).select('*').single()
    if (error || !data) return
    const { data: link, error: linkError } = await sb.from('inclusion_strategy_priority_barriers')
      .insert({ priority_id: data.id, barrier_id: barrierId }).select('id, priority_id, barrier_id').single()
    if (linkError) {
      await sb.from('inclusion_strategy_priorities').delete().eq('id', data.id)
      return
    }
    setPriorities(prev => [...prev, data])
    setPriorityLinks(prev => [...prev, link])
  }

  async function addManualActivity({ text, type, barrierIds }) {
    if (readOnly || !text || barrierIds.length === 0) return
    const count = priorities.length
    const { data, error } = await sb.from('inclusion_strategy_priorities').insert({
      strategy_id: draftId,
      principle: null,
      source_point_id: null,
      point_description: text,
      universal_or_targeted: type,
      sort_order: count,
    }).select('*').single()
    if (error || !data) return
    const rows = barrierIds.map(barrier_id => ({ priority_id: data.id, barrier_id }))
    const { data: links, error: linkError } = await sb.from('inclusion_strategy_priority_barriers')
      .insert(rows).select('id, priority_id, barrier_id')
    if (linkError) {
      await sb.from('inclusion_strategy_priorities').delete().eq('id', data.id)
      return
    }
    setPriorities(prev => [...prev, data])
    setPriorityLinks(prev => [...prev, ...(links ?? [])])
  }

  async function removeActivityLink(priorityId, barrierId) {
    if (readOnly) return
    const link = priorityLinks.find(l => l.priority_id === priorityId && l.barrier_id === barrierId)
    if (!link) return
    await sb.from('inclusion_strategy_priority_barriers').delete().eq('id', link.id)
    setPriorityLinks(prev => prev.filter(l => l.id !== link.id))
  }

  async function linkTrayActivity(priorityId, barrierId) {
    if (readOnly) return
    const { data, error } = await sb.from('inclusion_strategy_priority_barriers')
      .insert({ priority_id: priorityId, barrier_id: barrierId }).select('id, priority_id, barrier_id').single()
    if (error || !data) return
    setPriorityLinks(prev => [...prev, data])
  }

  if (loading) return <p className="state-msg">Loading…</p>

  const selectedBarrierIds = form.barrier_ids ?? []
  const priorityToBarrierIds = (() => {
    const m = new Map()
    for (const l of priorityLinks) {
      if (!m.has(l.priority_id)) m.set(l.priority_id, [])
      m.get(l.priority_id).push(l.barrier_id)
    }
    return m
  })()
  const barrierToPriorities = (() => {
    const m = new Map()
    const byId = new Map(priorities.map(p => [p.id, p]))
    for (const l of priorityLinks) {
      const p = byId.get(l.priority_id)
      if (!p) continue
      if (!m.has(l.barrier_id)) m.set(l.barrier_id, [])
      m.get(l.barrier_id).push(p)
    }
    return m
  })()
  const selectedBarriersNumbered = selectedBarrierIds
    .map(id => barriers.find(b => b.id === id))
    .filter(Boolean)
    .map((b, i) => ({ ...b, __number: i + 1 }))
  const entryStatusByPPForExport = (() => {
    const m = new Map()
    for (const e of allEntries) m.set(e.provision_point_id, e.status)
    return m
  })()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A202C' }}>Create Inclusion Strategy</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SaveIndicator status={saveStatus} />
            {onUpdateDashboard && (
              <button type="button" onClick={handleUpdateDashboard} style={{ ...smallBtn, padding: '6px 12px' }}>
                Update my dashboard
              </button>
            )}
          </div>
        </div>
        {draftCreateError && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            fontSize: '0.76rem', color: '#C0392B', background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.25)', borderRadius: 7, padding: '7px 10px', marginBottom: 8,
          }}>
            <span>Could not create your Inclusion Strategy draft — nothing here can be saved yet.</span>
            <button type="button" onClick={retryCreateDraft} style={{ ...smallBtn, padding: '4px 10px', flexShrink: 0 }}>
              Retry
            </button>
          </div>
        )}
        {saveError && (
          <p style={{
            fontSize: '0.76rem', color: '#C0392B', background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.25)', borderRadius: 7, padding: '7px 10px', marginBottom: 8,
          }}>
            {saveError}
          </p>
        )}
        <StepIndicator step={step} maxVisited={maxVisited} onJump={goToStep} />
      </div>

      {step === 1 && (
        <Step1Details form={form} setField={setField} readOnly={readOnly}
          onBlurSave={() => persistDraft(detailsAndTextFields())} />
      )}
      {step === 2 && (
        <Step2WhereYouAre provisionPoints={provisionPoints} allEntries={allEntries}
          onUpdateDashboard={onUpdateDashboard ? handleUpdateDashboard : null} />
      )}
      {step === 3 && (
        <Step3BarriersAndActivity
          school={school} sb={sb} domains={domains}
          barriers={barriers} setBarriers={setBarriers}
          provisionPoints={provisionPoints} allEntries={allEntries}
          form={form} selectedBarrierIds={selectedBarrierIds} toggleBarrierSelected={toggleBarrierSelected}
          updateBarrierNote={updateBarrierNote}
          priorities={priorities} priorityToBarrierIds={priorityToBarrierIds} barrierToPriorities={barrierToPriorities}
          addSuggestedActivity={addSuggestedActivity} addManualActivity={addManualActivity}
          removeActivityLink={removeActivityLink} linkTrayActivity={linkTrayActivity}
          readOnly={readOnly}
        />
      )}
      {step === 4 && (
        <Step4Outcomes
          outcomes={outcomes} selectedBarriers={selectedBarriersNumbered}
          onFieldChange={updateOutcomeField} onBlurSave={saveOutcomeRow}
          onDelete={deleteOutcomeRow} onAdd={addOutcomeRow} readOnly={readOnly}
        />
      )}
      {step === 5 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Statement of intent</h3>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
            A short statement setting out your school's overall approach and commitment to inclusion.
          </p>
          <textarea rows={12} style={{ ...inp, resize: 'vertical' }} disabled={readOnly}
            value={form.statement_of_intent ?? ''} onChange={e => setField('statement_of_intent', e.target.value)}
            onBlur={() => persistDraft(detailsAndTextFields())} />
          <div style={{ marginTop: 8 }}>
            {(() => {
              const text = form.statement_of_intent ?? ''
              const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
              return (
                <span style={{ fontSize: '0.72rem', color: wordCount > 500 ? '#D4751A' : '#94a3b8' }}>
                  {wordCount} word{wordCount !== 1 ? 's' : ''}{wordCount > 500 ? ' — over the suggested 500' : ''}
                </span>
              )
            })()}
          </div>
        </div>
      )}
      {step === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Review of the previous academic year</h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
              Optional in year one. How did last year's strategy go, and what changed as a result?
            </p>
            <textarea rows={8} style={{ ...inp, resize: 'vertical' }} disabled={readOnly}
              value={form.previous_year_review ?? ''} onChange={e => setField('previous_year_review', e.target.value)}
              onBlur={() => persistDraft(detailsAndTextFields())} />
          </div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A202C', marginBottom: 4 }}>Further information</h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
              Optional. Anything else worth including — links, contacts, or context for readers.
            </p>
            <textarea rows={8} style={{ ...inp, resize: 'vertical' }} disabled={readOnly}
              value={form.further_information ?? ''} onChange={e => setField('further_information', e.target.value)}
              onBlur={() => persistDraft(detailsAndTextFields())} />
          </div>
        </div>
      )}
      {step === 7 && (
        <Step7PreviewAndWord
          form={form} selectedBarriers={selectedBarriersNumbered} barrierToPriorities={barrierToPriorities}
          entryStatusByPP={entryStatusByPPForExport} schoolName={schoolName} readOnly={readOnly}
          outcomes={outcomes}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6 }}>
        <button type="button" style={ghostBtn} disabled={step === 1} onClick={() => goToStep(step - 1)}>
          Back
        </button>
        {step < STEP_LABELS.length && (
          <button type="button" style={primaryBtn} onClick={() => goToStep(step + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}
