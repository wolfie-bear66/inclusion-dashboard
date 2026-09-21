import { BARRIER_GROUPS, BARRIER_SCALES, BARRIER_SOURCES, BARRIER_STATUSES, STATUS_LABELS } from '../constants/barriers'
import { PRINCIPLE_LABEL_SHORT } from '../constants/principles'

// Shared barrier add/edit form body — used inside BarriersView's own modal (App.jsx) and
// the Inclusion Strategy wizard's barrier picker. Relocated from BarriersView's inline
// modal body verbatim; the only change is that the derived pieces it used to receive as
// props (filteredGroups, selectedTags, entryStatusByPP) are now computed in here from
// their own raw inputs (provisionPoints, allEntries, linkSearch, selectedLinks, noneFit,
// noneFitDomain) — same computation, same inputs, just local to this component instead of
// the caller's render, so the caller has fewer props to keep in sync.

const inp = {
  padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 7,
  fontSize: '0.83rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}
const lf = { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }
const lbl = { fontSize: '0.78rem', fontWeight: 600, color: '#374151' }
const errStyle = { fontSize: '0.72rem', color: '#DC2626', marginTop: 2 }

function SegCtrl({ options, value, onChange, small }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: '#E2E8F0', borderRadius: 7, padding: 3, alignSelf: 'flex-start' }}>
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
          padding: small ? '4px 10px' : '5px 14px', border: 'none', borderRadius: 5,
          fontSize: small ? '0.73rem' : '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
          fontWeight: value === opt.value ? 600 : 400,
          color:      value === opt.value ? '#1A202C' : '#64748b',
          background: value === opt.value ? '#fff' : 'transparent',
          boxShadow:  value === opt.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.12s', whiteSpace: 'nowrap',
        }}>{opt.label}</button>
      ))}
    </div>
  )
}

export default function BarrierForm({
  form, setField, formErrors, setFormErrors,
  noneFit, toggleNoneFit, noneFitDomain, setNoneFitDomain,
  selectedLinks, toggleLink,
  linkSearch, setLinkSearch,
  provisionPoints, allEntries, domainList,
  showMore, setShowMore,
}) {
  function toggleGroup(key) {
    setField('student_groups', { ...(form.student_groups ?? {}), [key]: !(form.student_groups ?? {})[key] })
  }

  const entryStatusByPP = (() => {
    const m = new Map()
    for (const e of allEntries) m.set(e.provision_point_id, e.status)
    return m
  })()

  const groupedProvisionPoints = (() => {
    const grouped = {}
    for (const pp of provisionPoints) {
      const domainName = pp.sub_domains?.domains?.name ?? 'Other'
      const subName    = pp.sub_domains?.name ?? ''
      const key = `${pp.sub_domains?.domain_id ?? ''}||${pp.sub_domain_id ?? ''}`
      ;(grouped[key] = grouped[key] ?? { domainName, subName, points: [] }).points.push(pp)
    }
    return Object.values(grouped)  // already in sidebar (display_order) order — provisionPoints is pre-sorted
  })()

  const linkSearchLower = linkSearch.toLowerCase()
  const filteredGroups = groupedProvisionPoints.map(g => ({
    ...g,
    points: g.points.filter(pp =>
      !linkSearchLower || (pp.label ?? '').toLowerCase().includes(linkSearchLower)
    ),
  })).filter(g => g.points.length > 0)

  const selectedTags = (() => {
    if (noneFit) return { domains: noneFitDomain ? [noneFitDomain] : [], principles: [], categories: [] }
    const points = provisionPoints.filter(pp => selectedLinks.has(pp.id))
    const domainIds  = [...new Set(points.map(pp => pp.sub_domains?.domain_id).filter(Boolean))]
    const principles = [...new Set(points.map(pp => pp.principle).filter(Boolean))]
    const categories = [...new Set(points.map(pp => pp.category).filter(Boolean))]
    return { domains: domainIds, principles, categories }
  })()

  return (
    <>
      {/* Description */}
      <div style={lf}>
        <label style={lbl}>What is the barrier? <span style={{ color: '#DC2626' }}>*</span></label>
        <textarea rows={3} value={form.description ?? ''} onChange={e => setField('description', e.target.value)}
          placeholder="Describe the barrier to learning or participation you have identified"
          style={{ ...inp, resize: 'vertical' }} />
        {formErrors.description && <span style={errStyle}>{formErrors.description}</span>}
      </div>

      {/* Which provision does this relate to? */}
      <div style={{ ...lf, marginBottom: 14 }}>
        <label style={lbl}>Which provision does this relate to? <span style={{ color: '#DC2626' }}>*</span></label>
        <p style={{ fontSize: '0.73rem', color: '#9CA3AF', marginBottom: 6 }}>
          Select the framework provision points that address this barrier. Domain, principle and category are set from these automatically.
        </p>

        {!noneFit && (
          <>
            <input type="text" placeholder="Search provision points…"
              value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
              style={{ ...inp, marginBottom: 8 }} />
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 240, overflowY: 'auto' }}>
              {filteredGroups.length === 0 ? (
                <p style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '0.8rem' }}>No provision points found.</p>
              ) : filteredGroups.map((g, gi) => (
                <div key={gi}>
                  <div style={{ padding: '7px 12px', background: '#F7F8FA',
                    borderBottom: '1px solid #E2E8F0', fontSize: '0.72rem',
                    fontWeight: 600, color: '#374151', position: 'sticky', top: 0 }}>
                    {g.domainName}{g.subName ? ` › ${g.subName}` : ''}
                  </div>
                  {g.points.map(pp => {
                    const checked = selectedLinks.has(pp.id)
                    const ppStatus = entryStatusByPP.get(pp.id)
                    const statusStyle = ppStatus === 'in_place' ? { color: '#257A3B', bg: 'rgba(37,122,59,0.10)' }
                      : ppStatus === 'in_progress' ? { color: '#D4751A', bg: 'rgba(212,117,26,0.10)' }
                      : { color: '#94a3b8', bg: '#F1F5F9' }
                    return (
                      <label key={pp.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', cursor: 'pointer',
                        background: checked ? 'rgba(27,54,93,0.04)' : '#fff',
                        borderBottom: '0.5px solid #F1F5F9',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleLink(pp.id)}
                          style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.8rem', color: '#1A202C' }}>
                          {pp.label ?? 'Untitled'}
                        </span>
                        {ppStatus && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 7px',
                            borderRadius: 20, background: statusStyle.bg, color: statusStyle.color,
                            whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {STATUS_LABELS[ppStatus] ?? ppStatus}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
            {selectedLinks.size > 0 && (
              <p style={{ fontSize: '0.73rem', color: '#1B365D', marginTop: 5, fontWeight: 500 }}>
                {selectedLinks.size} point{selectedLinks.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </>
        )}

        {/* None of these fit */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={noneFit} onChange={e => toggleNoneFit(e.target.checked)} />
          <span style={{ fontSize: '0.8rem', color: '#374151' }}>None of these fit</span>
        </label>
        {noneFit && (
          <div style={{ marginTop: 8, maxWidth: 280 }}>
            <select value={noneFitDomain} onChange={e => { setNoneFitDomain(e.target.value); setFormErrors(prev => ({ ...prev, domain: undefined })) }} style={inp}>
              <option value="">Select domain…</option>
              {domainList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        {formErrors.domain && <span style={errStyle}>{formErrors.domain}</span>}

        {/* Live-derived chips */}
        {(selectedTags.domains.length > 0 || selectedTags.principles.length > 0 || selectedTags.categories.length > 0) && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
            {selectedTags.domains.map(id => {
              const name = domainList.find(d => d.id === id)?.name
              return name ? (
                <span key={`d-${id}`} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 9px',
                  borderRadius: 999, background: 'rgba(27,54,93,0.09)', color: '#1B365D' }}>{name}</span>
              ) : null
            })}
            {selectedTags.principles.map(p => (
              <span key={`p-${p}`} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 9px',
                borderRadius: 999, background: 'rgba(91,33,182,0.09)', color: '#5B21B6' }}>{PRINCIPLE_LABEL_SHORT[p] ?? p}</span>
            ))}
            {selectedTags.categories.map(c => (
              <span key={`c-${c}`} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 9px',
                borderRadius: 999, background: 'rgba(30,64,175,0.09)', color: '#1E40AF' }}>{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Add more — collapsed by default */}
      <div style={{ marginBottom: 14 }}>
        <button type="button" onClick={() => setShowMore(v => !v)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.8rem', color: '#1B365D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <i className={`ti ${showMore ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: '0.75rem' }} />
          Add more
        </button>

        {showMore && (
          <div style={{ marginTop: 14 }}>
            {/* Student groups */}
            <div style={lf}>
              <label style={lbl}>Student groups affected</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BARRIER_GROUPS.map(g => {
                  const checked = !!(form.student_groups ?? {})[g.key]
                  return (
                    <label key={g.key} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 11px', borderRadius: 20,
                      border: `1.5px solid ${checked ? '#1B365D' : '#E2E8F0'}`,
                      background: checked ? 'rgba(27,54,93,0.07)' : '#fff',
                      cursor: 'pointer', fontSize: '0.78rem', color: checked ? '#1B365D' : '#374151',
                      fontWeight: checked ? 600 : 400, userSelect: 'none',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.key)}
                        style={{ display: 'none' }} />
                      {g.label}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Scale */}
            <div style={lf}>
              <label style={lbl}>Scale</label>
              <SegCtrl options={BARRIER_SCALES} value={form.scale ?? 'group'} onChange={v => setField('scale', v)} />
            </div>

            {/* Source */}
            <div style={lf}>
              <label style={lbl}>Source of identification</label>
              <select value={form.source ?? ''} onChange={e => setField('source', e.target.value)} style={{ ...inp }}>
                <option value="">Select source…</option>
                {BARRIER_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Status */}
            <div style={lf}>
              <label style={lbl}>Status</label>
              <SegCtrl options={BARRIER_STATUSES} value={form.status ?? 'active'} onChange={v => setField('status', v)} />
            </div>

            {/* Actions */}
            <div style={lf}>
              <label style={lbl}>Actions being taken (optional)</label>
              <textarea rows={2} value={form.actions ?? ''} onChange={e => setField('actions', e.target.value)}
                placeholder="Describe what is currently being done to address this barrier"
                style={{ ...inp, resize: 'vertical' }} />
            </div>

            {/* Date fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={lbl}>Date identified (optional)</label>
                <input type="date" value={form.date_identified ?? ''} onChange={e => setField('date_identified', e.target.value || null)}
                  style={inp} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={lbl}>Next evaluate &amp; sustain date</label>
                <input type="date" value={form.next_review_due ?? ''} onChange={e => setField('next_review_due', e.target.value || null)}
                  style={inp} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
