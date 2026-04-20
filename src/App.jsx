import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const STATUSES = ['in_place', 'in_progress', 'not_in_place']
const STATUS_LABELS = { in_place: 'In Place', in_progress: 'In Progress', not_in_place: 'Not In Place' }
const SEND_TIERS = [
  { value: 'universal',     label: 'Universal' },
  { value: 'targeted',      label: 'Targeted' },
  { value: 'targeted_plus', label: 'Targeted Plus' },
  { value: 'specialist',    label: 'Specialist' },
]
const FUNDING_SOURCES = [
  { value: 'pupil_premium',             label: 'Pupil Premium' },
  { value: 'send_budget',               label: 'SEND Budget' },
  { value: 'inclusive_mainstream_fund', label: 'Inclusive Mainstream Fund' },
  { value: 'sport_premium',             label: 'Sport Premium' },
  { value: 'school_general_budget',     label: 'School General Budget' },
]
const REVIEW_CYCLES = [
  { value: 'weekly',      label: 'Weekly' },
  { value: 'half_termly', label: 'Half-termly' },
  { value: 'termly',      label: 'Termly' },
  { value: 'annual',      label: 'Annual' },
  { value: 'as_needed',   label: 'As needed' },
]

// entries holds status + group flags; evidence detail lives in evidence_entries (nested)
const ENTRY_SELECT = [
  'id', 'provision_point_id', 'status',
  'grp_send', 'grp_pp', 'grp_eal', 'grp_fsm', 'grp_lac', 'grp_wwc', 'grp_other',
  'evidence_entries(id, provision_name, brief_description, indicator_type, named_role_policy_document, owner, send_tiers, delivered_by_role, funding_source, cost, evidence_notes, review_cycle, notes)',
].join(', ')

export default function App() {
  const [schools, setSchools] = useState([])
  const [domains, setDomains] = useState([])
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subDomains, setSubDomains] = useState([])
  const [entries, setEntries] = useState({})         // { [pp_id]: { id, status, grp_* } }
  const [evidenceEntries, setEvidenceEntries] = useState({}) // { [pp_id]: [evidenceEntry] }
  const [loading, setLoading] = useState(false)
  const [ppDomainMap, setPpDomainMap] = useState({})   // { [pp_id]: domain_id }
  const [domainTotals, setDomainTotals] = useState({}) // { [domain_id]: total_pp_count }
  const [allStatuses, setAllStatuses] = useState({})      // { [pp_id]: status } — all domains, current school
  const [allEvidenceCounts, setAllEvidenceCounts] = useState({}) // { [pp_id]: count } — evidence_entries per pp

  // Modal state
  const [modalPoint, setModalPoint] = useState(null) // { id, label }
  const [draft, setDraft] = useState({})
  const [draftId, setDraftId] = useState(null)       // null = new, uuid = existing evidence_entry
  const [modalSaving, setModalSaving] = useState(false)
  const [modalSaveMsg, setModalSaveMsg] = useState(null)
  const [modalSaveError, setModalSaveError] = useState(false)
  const modalRef = useRef(null)

  useEffect(() => {
    supabase.from('schools').select('id, name').order('name').then(({ data, error }) => {
      if (error) console.error('Error loading schools:', error)
      else setSchools(data ?? [])
    })
    supabase
      .from('domains')
      .select('id, name, display_order, sub_domains(provision_points(id))')
      .order('display_order')
      .then(({ data, error }) => {
        if (error) { console.error('Error loading domains:', error); return }
        const newPpDomainMap = {}
        const newDomainTotals = {}
        for (const domain of data ?? []) {
          let count = 0
          for (const sd of domain.sub_domains ?? []) {
            for (const pp of sd.provision_points ?? []) {
              newPpDomainMap[pp.id] = domain.id
              count++
            }
          }
          newDomainTotals[domain.id] = count
        }
        setDomains((data ?? []).map(({ sub_domains: _sd, ...d }) => d))
        setPpDomainMap(newPpDomainMap)
        setDomainTotals(newDomainTotals)
      })
  }, [])

  // Lightweight load: statuses + evidence counts for all domains, current school
  useEffect(() => {
    if (!selectedSchool) { setAllStatuses({}); setAllEvidenceCounts({}); return }
    supabase
      .from('entries')
      .select('provision_point_id, status, evidence_entries(id)')
      .eq('school_id', selectedSchool)
      .then(({ data, error }) => {
        if (error) { console.error('Error loading school data:', error); return }
        const statusMap = {}
        const evidenceMap = {}
        for (const e of data ?? []) {
          statusMap[e.provision_point_id] = e.status
          evidenceMap[e.provision_point_id] = (e.evidence_entries ?? []).length
        }
        setAllStatuses(statusMap)
        setAllEvidenceCounts(evidenceMap)
      })
  }, [selectedSchool])

  useEffect(() => {
    if (!selectedSchool || !selectedDomain) {
      setSubDomains([])
      setEntries({})
      setEvidenceEntries({})
      return
    }

    setLoading(true)

    Promise.all([
      supabase
        .from('sub_domains')
        .select('id, name, provision_points(id, label, display_order)')
        .eq('domain_id', selectedDomain)
        .order('name'),
      supabase
        .from('entries')
        .select(ENTRY_SELECT)
        .eq('school_id', selectedSchool),
    ]).then(([subDomainsRes, entriesRes]) => {
      if (subDomainsRes.error) console.error('Error loading sub_domains:', subDomainsRes.error)
      if (entriesRes.error) console.error('Error loading entries:', entriesRes.error)

      const grouped = (subDomainsRes.data ?? []).map(sd => ({
        ...sd,
        provision_points: (sd.provision_points ?? []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }))

      const entryMap = {}
      const evidenceMap = {}
      for (const { provision_point_id, evidence_entries: evList, ...rest } of entriesRes.data ?? []) {
        entryMap[provision_point_id] = rest
        evidenceMap[provision_point_id] = evList ?? []
      }

      setSubDomains(grouped)
      setEntries(entryMap)
      setEvidenceEntries(evidenceMap)
      setLoading(false)
    })
  }, [selectedSchool, selectedDomain])

  useEffect(() => {
    document.body.style.overflow = modalPoint ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalPoint])

  // evidenceEntry = null → new; evidenceEntry = existing row → edit
  function openModal(pp, evidenceEntry = null) {
    setModalPoint(pp)
    setDraft(evidenceEntry ? { ...evidenceEntry } : {})
    setDraftId(evidenceEntry?.id ?? null)
    setModalSaveMsg(null)
    setModalSaveError(false)
  }

  function closeModal() {
    setModalPoint(null)
    setDraft({})
    setDraftId(null)
    setModalSaveMsg(null)
  }

  function handleDraftChange(field, value) {
    setModalSaveMsg(null)
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function handleStatusChange(ppId, status) {
    const currentEntry = entries[ppId] ?? {}
    setEntries(prev => ({ ...prev, [ppId]: { ...currentEntry, status } }))
    setAllStatuses(prev => ({ ...prev, [ppId]: status }))

    const { data, error } = await supabase
      .from('entries')
      .upsert(
        [{ school_id: selectedSchool, provision_point_id: ppId, ...currentEntry, status }],
        { onConflict: 'school_id,provision_point_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('Error saving status:', error)
    } else if (data?.id && !currentEntry.id) {
      setEntries(prev => ({ ...prev, [ppId]: { ...prev[ppId], id: data.id } }))
    }
  }

  async function handleModalSave() {
    if (!selectedSchool || !modalPoint) return
    setModalSaving(true)
    setModalSaveMsg(null)

    // Step 1: ensure entries row exists and get its id
    const currentEntry = entries[modalPoint.id] ?? {}
    const { data: entryRow, error: entryError } = await supabase
      .from('entries')
      .upsert(
        [{ school_id: selectedSchool, provision_point_id: modalPoint.id, ...currentEntry }],
        { onConflict: 'school_id,provision_point_id' }
      )
      .select('id')
      .single()

    if (entryError) {
      setModalSaving(false)
      setModalSaveError(true)
      setModalSaveMsg(entryError.message)
      return
    }

    if (!currentEntry.id) {
      setEntries(prev => ({ ...prev, [modalPoint.id]: { ...prev[modalPoint.id], id: entryRow.id } }))
    }

    // Step 2: insert or update evidence_entry
    const { data: saved, error: saveError } = draftId
      ? await supabase.from('evidence_entries').update(draft).eq('id', draftId).select().single()
      : await supabase.from('evidence_entries').insert([{ entry_id: entryRow.id, ...draft }]).select().single()

    setModalSaving(false)
    setModalSaveError(!!saveError)

    if (saveError) {
      setModalSaveMsg(saveError.message)
    } else {
      if (draftId) {
        setEvidenceEntries(prev => ({
          ...prev,
          [modalPoint.id]: (prev[modalPoint.id] ?? []).map(e => e.id === draftId ? saved : e),
        }))
      } else {
        setEvidenceEntries(prev => ({
          ...prev,
          [modalPoint.id]: [...(prev[modalPoint.id] ?? []), saved],
        }))
          setDraftId(saved.id)
        setAllEvidenceCounts(prev => ({ ...prev, [modalPoint.id]: (prev[modalPoint.id] ?? 0) + 1 }))
      }
      setModalSaveMsg('Saved.')
    }
  }

  async function handleModalDelete() {
    if (!draftId || !window.confirm('Delete this evidence entry? This cannot be undone.')) return
    setModalSaving(true)

    const { error } = await supabase.from('evidence_entries').delete().eq('id', draftId)

    setModalSaving(false)
    if (error) {
      setModalSaveError(true)
      setModalSaveMsg(error.message)
    } else {
      setEvidenceEntries(prev => ({
        ...prev,
        [modalPoint.id]: (prev[modalPoint.id] ?? []).filter(e => e.id !== draftId),
      }))
      setAllEvidenceCounts(prev => ({ ...prev, [modalPoint.id]: Math.max(0, (prev[modalPoint.id] ?? 0) - 1) }))
      closeModal()
    }
  }

  function handleOverlayClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) closeModal()
  }

  const allPoints = subDomains.flatMap(sd => sd.provision_points)
  const answeredCount = allPoints.filter(p => entries[p.id]?.status).length
  const progress = allPoints.length ? Math.round((answeredCount / allPoints.length) * 100) : 0

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-title">Inclusion Dashboard</h1>
        <p className="header-sub">Data Entry</p>
      </header>

      <main className="main">
        <div className="selectors">
          <div className="selector-row">
            <label htmlFor="school-select" className="field-label">School</label>
            <select id="school-select" value={selectedSchool} onChange={e => { setSelectedSchool(e.target.value); setSelectedDomain('') }} className="select">
              <option value="">— Select a school —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <nav className="domain-nav" aria-label="Domains">
          <button
            type="button"
            className={`domain-tab domain-tab--overview${!selectedDomain ? ' domain-tab--active' : ''}`}
            onClick={() => setSelectedDomain('')}
          >
            <span className="domain-tab-name">Overview</span>
            <span className="domain-tab-count">{Object.keys(ppDomainMap).length > 0 ? `${Object.values(allStatuses).filter(Boolean).length}/${Object.keys(ppDomainMap).length}` : '—'}</span>
          </button>
          {domains.map(d => {
            const total = domainTotals[d.id] ?? 0
            const answered = Object.entries(ppDomainMap).filter(
              ([ppId, domId]) => domId === d.id && allStatuses[ppId]
            ).length
            return (
              <button
                key={d.id}
                type="button"
                className={`domain-tab${selectedDomain === d.id ? ' domain-tab--active' : ''}`}
                onClick={() => setSelectedDomain(d.id)}
              >
                <span className="domain-tab-name">{d.name}</span>
                <span className="domain-tab-count">{answered}/{total}</span>
              </button>
            )
          })}
        </nav>

        {selectedSchool && !selectedDomain && (() => {
          const allPpIds = Object.keys(ppDomainMap)
          const totTotal    = allPpIds.length
          const totInPlace  = allPpIds.filter(id => allStatuses[id] === 'in_place').length
          const totInProg   = allPpIds.filter(id => allStatuses[id] === 'in_progress').length
          const totNotIn    = allPpIds.filter(id => allStatuses[id] === 'not_in_place').length
          const totEvidence = allPpIds.filter(id => (allEvidenceCounts[id] ?? 0) > 0).length
          return (
            <div className="dashboard">
              <div className="dash-summary">
                <div className="dash-stat">
                  <span className="dash-stat-value">{totTotal}</span>
                  <span className="dash-stat-label">Total Points</span>
                </div>
                <div className="dash-stat dash-stat--green">
                  <span className="dash-stat-value">{totInPlace}</span>
                  <span className="dash-stat-label">In Place</span>
                </div>
                <div className="dash-stat dash-stat--amber">
                  <span className="dash-stat-value">{totInProg}</span>
                  <span className="dash-stat-label">In Progress</span>
                </div>
                <div className="dash-stat dash-stat--red">
                  <span className="dash-stat-value">{totNotIn}</span>
                  <span className="dash-stat-label">Not In Place</span>
                </div>
                <div className="dash-stat dash-stat--blue">
                  <span className="dash-stat-value">{totEvidence}</span>
                  <span className="dash-stat-label">With Evidence</span>
                </div>
              </div>

              <div className="dash-grid">
                {domains.map(d => {
                  const ppIds    = Object.entries(ppDomainMap).filter(([, did]) => did === d.id).map(([id]) => id)
                  const total    = ppIds.length
                  const inPlace  = ppIds.filter(id => allStatuses[id] === 'in_place').length
                  const inProg   = ppIds.filter(id => allStatuses[id] === 'in_progress').length
                  const notIn    = ppIds.filter(id => allStatuses[id] === 'not_in_place').length
                  const answered = inPlace + inProg + notIn
                  const evidence = ppIds.filter(id => (allEvidenceCounts[id] ?? 0) > 0).length
                  const pct      = total ? Math.round((answered / total) * 100) : 0
                  return (
                    <button key={d.id} type="button" className="dash-card" onClick={() => setSelectedDomain(d.id)}>
                      <h3 className="dash-card-name">{d.name}</h3>
                      <div className="dash-progress">
                        <div className="dash-progress-track">
                          <div className="dash-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="dash-progress-label">{answered}/{total}</span>
                      </div>
                      <div className="dash-counts">
                        <span className="dash-count dash-count--green">{inPlace} in place</span>
                        <span className="dash-count dash-count--amber">{inProg} in progress</span>
                        <span className="dash-count dash-count--red">{notIn} not in place</span>
                      </div>
                      <div className="dash-evidence">
                        <span className="dash-evidence-icon">◆</span>
                        {evidence} provision point{evidence !== 1 ? 's' : ''} with evidence
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {selectedSchool && selectedDomain && (
          loading ? (
            <p className="state-msg">Loading…</p>
          ) : subDomains.length === 0 ? (
            <p className="state-msg">No provision points found for this domain.</p>
          ) : (
            <>
              <div className="progress-wrap">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-label">{answeredCount} / {allPoints.length} answered</span>
              </div>

              {subDomains.map(sd => (
                <section key={sd.id} className="subdomain">
                  <h2 className="subdomain-title">{sd.name}</h2>
                  <div className="provision-list">
                    {sd.provision_points.map(pp => {
                      const entry = entries[pp.id] ?? {}
                      const evList = evidenceEntries[pp.id] ?? []
                      return (
                        <div key={pp.id} className="provision-item">

                          <div className="provision-row">
                            <span className="provision-name">{pp.label}</span>
                            {evList.length > 0 && (
                              <span className="evidence-count-badge" title={`${evList.length} evidence ${evList.length === 1 ? 'entry' : 'entries'}`}>
                                {evList.length}
                              </span>
                            )}
                            <div className="provision-actions">
                              <div className="status-group">
                                {STATUSES.map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`status-btn status-btn--${s.replace(/_/g, '-')}${entry.status === s ? ' active' : ''}`}
                                    onClick={() => handleStatusChange(pp.id, s)}
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                              <button type="button" className="evidence-btn" onClick={() => openModal(pp)}>
                                Add Evidence
                              </button>
                            </div>
                          </div>

                          {evList.length > 0 && (
                            <ul className="evidence-list">
                              {evList.map(ev => (
                                <li key={ev.id}>
                                  <button
                                    type="button"
                                    className="evidence-list-item"
                                    onClick={() => openModal(pp, ev)}
                                  >
                                    {ev.provision_name || 'Untitled entry'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </>
          )
        )}
      </main>

      {modalPoint && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" ref={modalRef} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2 className="modal-title">{modalPoint.label}</h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">

                <div className="df df--half">
                  <label>Provision Name</label>
                  <input type="text" value={draft.provision_name ?? ''} onChange={e => handleDraftChange('provision_name', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Indicator Type</label>
                  <input type="text" placeholder="e.g. Named role, Policy, Programme" value={draft.indicator_type ?? ''} onChange={e => handleDraftChange('indicator_type', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Brief Description</label>
                  <textarea rows={2} value={draft.brief_description ?? ''} onChange={e => handleDraftChange('brief_description', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Named Role / Policy / Document</label>
                  <input type="text" value={draft.named_role_policy_document ?? ''} onChange={e => handleDraftChange('named_role_policy_document', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>Owner</label>
                  <input type="text" value={draft.owner ?? ''} onChange={e => handleDraftChange('owner', e.target.value)} />
                </div>

                <div className="df df--half">
                  <label>SEND Tiers</label>
                  <div className="tier-checkbox-group">
                    {SEND_TIERS.map(t => {
                      const selected = Array.isArray(draft.send_tiers) ? draft.send_tiers : []
                      const checked = selected.includes(t.value)
                      return (
                        <label key={t.value} className="tier-checkbox-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selected.filter(v => v !== t.value)
                                : [...selected, t.value]
                              handleDraftChange('send_tiers', next)
                            }}
                          />
                          {t.label}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="df df--half">
                  <label>Delivered By Role</label>
                  <input type="text" value={draft.delivered_by_role ?? ''} onChange={e => handleDraftChange('delivered_by_role', e.target.value)} />
                </div>

                <div className="df df--quarter">
                  <label>Annual Cost £</label>
                  <input
                    type="number" min="0" step="1"
                    value={draft.cost ?? ''}
                    onChange={e => handleDraftChange('cost', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>

                <div className="df df--half">
                  <label>Funding Source</label>
                  <select value={draft.funding_source ?? ''} onChange={e => handleDraftChange('funding_source', e.target.value)}>
                    <option value="">—</option>
                    {FUNDING_SOURCES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="df df--half">
                  <label>Review Cycle</label>
                  <select value={draft.review_cycle ?? ''} onChange={e => handleDraftChange('review_cycle', e.target.value)}>
                    <option value="">—</option>
                    {REVIEW_CYCLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div className="df df--full">
                  <label>Evidence of Impact</label>
                  <textarea rows={3} value={draft.evidence_notes ?? ''} onChange={e => handleDraftChange('evidence_notes', e.target.value)} />
                </div>

                <div className="df df--full">
                  <label>Notes</label>
                  <textarea rows={2} value={draft.notes ?? ''} onChange={e => handleDraftChange('notes', e.target.value)} />
                </div>

              </div>
            </div>

            <div className="modal-footer">
              {draftId && (
                <button type="button" className="delete-btn" onClick={handleModalDelete} disabled={modalSaving}>
                  Delete
                </button>
              )}
              <div className="modal-footer-right">
                {modalSaveMsg && (
                  <span className={`save-msg${modalSaveError ? ' save-msg--error' : ' save-msg--ok'}`}>
                    {modalSaveMsg}
                  </span>
                )}
                <button type="button" className="modal-cancel-btn" onClick={closeModal}>Close</button>
                <button type="button" className="save-btn" onClick={handleModalSave} disabled={modalSaving}>
                  {modalSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
