import { useEffect, useMemo, useState } from 'react'
import { usePrincipleCoverage } from '../hooks/usePrincipleCoverage'
import { PRINCIPLE_LABEL_SHORT, STATIC_REVIEW_CATEGORIES } from '../constants/principles'

const INVITE_FUNCTION_URL = 'https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/invite-user'
const PUBLISHABLE_KEY = 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb'
const POLICY_CATEGORY = 'Policy / Published Document'

// Category display copy — same two categories and order as STATIC_REVIEW_CATEGORIES
// (App.jsx), just with warmer step titles for the wizard itself.
const CATEGORY_COPY = {
  'Named Person': {
    step: 'Named person roles',
    intro: "Who's your named person for each of these? A name and email is enough — we'll invite them.",
  },
  'Policy / Published Document': {
    step: 'Policies & published documents',
    intro: "Who owns keeping each of these up to date? Add them the same way — a name and email is enough.",
  },
}

function splitName(fullName) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ')
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { first_name: trimmed, last_name: '' }
  return { first_name: trimmed.slice(0, spaceIdx), last_name: trimmed.slice(spaceIdx + 1) }
}

export default function BootstrapWizard({ schoolId, schoolName, userId, firstName, matId, supabase, onDismiss }) {
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState([]) // { id, label, category, principle }
  // ppId -> { assigneeUserId, displayName, pending }
  const [assignments, setAssignments] = useState({})
  const [entryStatusByPp, setEntryStatusByPp] = useState({}) // ppId -> status | undefined
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [fields, setFields] = useState({}) // ppId -> { name, email }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successNote, setSuccessNote] = useState(null)
  const [allDone, setAllDone] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  // Full onboarding_state jsonb, kept locally so every patch merges onto the latest known
  // value instead of stomping keys another part of the app may have touched (e.g.
  // team_prompt_dismissed) with a stale read.
  const [obState, setObState] = useState({})

  // Cache of email -> { userId, firstName, lastName }. Persisted into
  // onboarding_state.bootstrap_wizard_email_cache (not just component state) so naming the
  // same colleague against a second role/point doesn't re-invite them (and fail on
  // "already registered") even after a "Finish later" dismiss-and-resume — profiles has no
  // email column to look this up from directly, so this cache is the only record of it.
  const [emailCache, setEmailCache] = useState({})

  const { principleData } = usePrincipleCoverage(supabase, schoolId, refreshToken)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: ppData, error: ppErr } = await supabase
        .from('provision_points')
        .select('id, label, category, principle, display_order')
        .in('category', STATIC_REVIEW_CATEGORIES)
        .eq('active', true)
        .order('category', { ascending: false }) // puts 'Named Person' before 'Policy / Published Document'
        .order('display_order', { ascending: true })
      if (ppErr || cancelled) { setLoading(false); return }
      const ppIds = (ppData ?? []).map(p => p.id)

      const [assignRes, entryRes, obRes] = await Promise.all([
        supabase.from('point_assignments').select('provision_point_id, assignee_user_id').eq('school_id', schoolId).in('provision_point_id', ppIds),
        supabase.from('entries').select('provision_point_id, status').eq('school_id', schoolId).in('provision_point_id', ppIds),
        supabase.from('profiles').select('onboarding_state').eq('id', userId).single(),
      ])
      if (cancelled) return

      const loadedObState = obRes.data?.onboarding_state ?? {}
      setObState(loadedObState)
      setEmailCache(loadedObState.bootstrap_wizard_email_cache ?? {})

      const assigneeIds = [...new Set((assignRes.data ?? []).map(a => a.assignee_user_id))]
      let profilesById = {}
      if (assigneeIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, password_set')
          .in('id', assigneeIds)
        profilesById = Object.fromEntries((profileRows ?? []).map(p => [p.id, p]))
      }

      const assignMap = {}
      for (const a of assignRes.data ?? []) {
        const prof = profilesById[a.assignee_user_id]
        assignMap[a.provision_point_id] = {
          assigneeUserId: a.assignee_user_id,
          displayName: prof ? `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim() || 'Team member' : 'Team member',
          pending: prof ? prof.password_set !== true : true,
        }
      }

      const statusMap = Object.fromEntries((entryRes.data ?? []).map(e => [e.provision_point_id, e.status]))

      if (cancelled) return
      setPoints(ppData ?? [])
      setAssignments(assignMap)
      setEntryStatusByPp(statusMap)

      // Resume at the first category that still has unassigned points; if both are
      // fully assigned, there's nothing left for this wizard to do.
      const categories = STATIC_REVIEW_CATEGORIES
      const firstIncomplete = categories.findIndex(cat =>
        (ppData ?? []).some(p => p.category === cat && !assignMap[p.id])
      )
      if (firstIncomplete === -1) {
        setAllDone(true)
      } else {
        setCategoryIndex(firstIncomplete)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, schoolId, userId])

  const category = STATIC_REVIEW_CATEGORIES[categoryIndex]
  const categoryPoints = useMemo(
    () => points.filter(p => p.category === category),
    [points, category]
  )
  const isLastCategory = categoryIndex === STATIC_REVIEW_CATEGORIES.length - 1

  function updateField(ppId, key, value) {
    setFields(prev => ({ ...prev, [ppId]: { ...prev[ppId], [key]: value } }))
  }

  // Policy-row link input and "exists, no link yet" toggle are mutually exclusive —
  // filling one clears the other, rather than letting both be set at once.
  function updateLink(ppId, value) {
    setFields(prev => ({
      ...prev,
      [ppId]: { ...prev[ppId], link: value, existsNoLink: value ? false : prev[ppId]?.existsNoLink },
    }))
  }
  function toggleExistsNoLink(ppId) {
    setFields(prev => {
      const cur = prev[ppId] ?? {}
      const next = !cur.existsNoLink
      return { ...prev, [ppId]: { ...cur, existsNoLink: next, link: next ? '' : cur.link } }
    })
  }

  // Merges onto the latest locally-known onboarding_state (not a stale closure) and
  // persists the merged result — every caller can pass just the keys it's changing.
  async function patchOnboardingState(patch) {
    const merged = { ...obState, ...patch }
    setObState(merged)
    await supabase.from('profiles').update({ onboarding_state: merged }).eq('id', userId)
    return merged
  }

  async function handleSubmit({ finishAfter }) {
    setSubmitting(true)
    setError(null)
    setSuccessNote(null)

    // Rows filled in this pass, for points in the current category that aren't already assigned.
    const rowsToProcess = categoryPoints
      .filter(p => !assignments[p.id])
      .map(p => ({
        point: p,
        name: (fields[p.id]?.name ?? '').trim(),
        email: (fields[p.id]?.email ?? '').trim(),
        link: (fields[p.id]?.link ?? '').trim(),
        existsNoLink: !!fields[p.id]?.existsNoLink,
      }))
      .filter(r => r.name && r.email)

    const localEmailCache = { ...emailCache }
    const rowErrors = []
    const newAssignments = {}
    const pointAssignmentRows = []
    const entryRows = [] // { school_id, provision_point_id, status } — status varies per row now
    // Policy rows with a link, keyed by provision_point_id — resolved to entry_id once the
    // entries upsert below returns ids, then written in one follow-up evidence_entries insert.
    const linksByPp = {}
    const jobTitleUpdates = [] // { userId, jobTitle } — only for freshly-created profiles this pass

    for (const row of rowsToProcess) {
      const emailKey = row.email.toLowerCase()
      let cached = localEmailCache[emailKey]

      if (!cached) {
        const { first_name, last_name } = splitName(row.name)
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
              first_name, last_name,
              email: row.email,
              role: 'contributor',
              school_id: schoolId,
              mat_id: matId,
            }),
          })
          const json = await res.json()
          if (!res.ok || json.error) {
            rowErrors.push(`${row.point.label}: ${json.error ?? 'Could not send the invite.'}`)
            continue
          }
          if (json.profileError || !json.userId) {
            rowErrors.push(`${row.point.label}: invite sent, but the profile couldn't be created — contact hello@inclusiondashboard.co.uk.`)
            continue
          }
          cached = { userId: json.userId, first_name, last_name }
          localEmailCache[emailKey] = cached
          jobTitleUpdates.push({ userId: json.userId, jobTitle: row.point.label })
        } catch {
          rowErrors.push(`${row.point.label}: could not reach the server for this invite.`)
          continue
        }
      }

      newAssignments[row.point.id] = {
        assigneeUserId: cached.userId,
        displayName: `${cached.first_name} ${cached.last_name}`.trim(),
        pending: true,
      }
      pointAssignmentRows.push({
        provision_point_id: row.point.id,
        assignee_user_id: cached.userId,
        school_id: schoolId,
        assigned_by: userId,
      })
      // Only write an entries status if the point has no recorded status yet — never
      // overwrite work that's already further along.
      if (!entryStatusByPp[row.point.id]) {
        if (row.point.category === POLICY_CATEGORY) {
          if (row.link) {
            // A link is the evidence — the point can genuinely be in_place, not just in_progress.
            entryRows.push({ school_id: schoolId, provision_point_id: row.point.id, status: 'in_place' })
            linksByPp[row.point.id] = row.link
          } else if (row.existsNoLink) {
            entryRows.push({ school_id: schoolId, provision_point_id: row.point.id, status: 'in_progress' })
          }
          // Neither link nor "exists, no link yet" — no entries write, row stays open.
        } else {
          // Named Person: name + email captured at wizard time is itself sufficient
          // evidence — there's nothing further to attach, and no self-approval concern
          // since the wizard is run by the approving admin at first login.
          entryRows.push({ school_id: schoolId, provision_point_id: row.point.id, status: 'in_place' })
        }
      }
    }

    if (pointAssignmentRows.length > 0) {
      const { error: assignErr } = await supabase
        .from('point_assignments')
        .upsert(pointAssignmentRows, { onConflict: 'provision_point_id,school_id', ignoreDuplicates: true })
      if (assignErr) rowErrors.push(`Some assignments could not be saved: ${assignErr.message}`)
    }
    // Call 1 of 2 for the new Policy-link logic — one batched upsert for every point in this
    // pass needing a status write, regardless of category or how many rows there are.
    let entryIdByPp = {}
    if (entryRows.length > 0) {
      const { data: savedEntries, error: entryErr } = await supabase
        .from('entries')
        .upsert(entryRows, { onConflict: 'school_id,provision_point_id' })
        .select('id, provision_point_id')
      if (entryErr) {
        rowErrors.push(`Some points could not be updated: ${entryErr.message}`)
      } else {
        entryIdByPp = Object.fromEntries((savedEntries ?? []).map(e => [e.provision_point_id, e.id]))
      }
    }
    // Call 2 of 2 — one batched insert covering every Policy row with a link in this pass,
    // using the same minimal { entry_id, supporting_document_link } shape the general
    // evidence-modal save already uses (App.jsx's handleSaveEvidence-equivalent), not a new
    // write pattern. evidence_entries has no other NOT NULL column without a default, so
    // nothing else needs to be set (evidence_type/grp_* all default on their own).
    const evidenceInsertRows = Object.entries(linksByPp)
      .filter(([ppId]) => entryIdByPp[ppId])
      .map(([ppId, link]) => ({ entry_id: entryIdByPp[ppId], supporting_document_link: link }))
    if (evidenceInsertRows.length > 0) {
      const { error: evidenceErr } = await supabase.from('evidence_entries').insert(evidenceInsertRows)
      if (evidenceErr) rowErrors.push(`Some policy links could not be saved: ${evidenceErr.message}`)
    }
    for (const { userId: uid, jobTitle } of jobTitleUpdates) {
      await supabase.from('profiles').update({ job_title: jobTitle }).eq('id', uid)
    }

    setEmailCache(localEmailCache)
    const cacheGrew = Object.keys(localEmailCache).length > Object.keys(emailCache).length
    if (Object.keys(newAssignments).length > 0) {
      setAssignments(prev => ({ ...prev, ...newAssignments }))
      setEntryStatusByPp(prev => {
        const next = { ...prev }
        for (const row of entryRows) next[row.provision_point_id] = row.status
        return next
      })
      setRefreshToken(t => t + 1) // one refetch of the readiness bars, for everything banked in this pass
    }
    // Persist the (possibly grown) email cache so it survives a "Finish later" dismiss —
    // otherwise the same colleague named against a point in a later session gets re-invited
    // and invite-user rejects the duplicate email.
    if (cacheGrew) {
      await patchOnboardingState({ bootstrap_wizard_email_cache: localEmailCache })
    }

    setSubmitting(false)

    if (rowErrors.length > 0) {
      setError(rowErrors.join(' '))
    } else if (Object.keys(newAssignments).length > 0) {
      setSuccessNote(`Saved — ${Object.keys(newAssignments).length} point${Object.keys(newAssignments).length !== 1 ? 's' : ''} updated.`)
    }

    if (rowErrors.length === 0) {
      setFields({})
      if (finishAfter) {
        await patchOnboardingState({ bootstrap_wizard_dismissed: true })
        onDismiss()
      } else if (!isLastCategory) {
        setCategoryIndex(i => i + 1)
        setSuccessNote(null)
      }
    }
  }

  async function handleFinishLater() {
    await handleSubmit({ finishAfter: false })
    onDismiss()
  }

  async function handleAllDoneClose() {
    await patchOnboardingState({ bootstrap_wizard_dismissed: true })
    onDismiss()
  }

  if (loading) return null

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.50)' }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1051,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 720, maxHeight: '88vh',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          background: '#fff', display: 'flex', flexDirection: 'column',
        }}>
          {/* Navy header */}
          <div style={{ background: '#1B365D', padding: '24px 28px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.35 }}>
                  {allDone ? `You're all set, ${firstName || 'there'}.` : `Let's get ${schoolName || 'your school'} set up.`}
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {allDone
                    ? 'Every named person and policy already has an owner.'
                    : 'Every school needs someone named against these roles and policies — this is quick, and you can always finish it later.'}
                </p>
              </div>
              {!allDone && (
                <button type="button" onClick={handleFinishLater} disabled={submitting} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)',
                  fontSize: '0.78rem', fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer',
                  flexShrink: 0, padding: '4px 0', textDecoration: 'underline',
                }}>
                  Finish later
                </button>
              )}
            </div>
          </div>

          {/* Principle readiness bars — always visible */}
          <div style={{
            padding: '14px 28px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
            display: 'flex', flexWrap: 'wrap', gap: 10, background: '#F7F8FA',
          }}>
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

          {allDone ? (
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <button type="button" onClick={handleAllDoneClose} style={{
                padding: '10px 24px', borderRadius: 9, border: 'none',
                background: '#1B365D', color: '#fff', fontSize: '0.88rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Got it
              </button>
            </div>
          ) : (
            <>
              {/* Step indicator + intro */}
              <div style={{ padding: '16px 28px 8px', flexShrink: 0 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 4px' }}>
                  Step {categoryIndex + 1} of {STATIC_REVIEW_CATEGORIES.length} — {CATEGORY_COPY[category]?.step ?? category}
                </p>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  {CATEGORY_COPY[category]?.intro}
                </p>
              </div>

              {/* Point rows */}
              <div style={{ padding: '12px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {categoryPoints.map(p => {
                  const assigned = assignments[p.id]
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                      background: assigned ? '#F7F8FA' : '#fff',
                    }}>
                      <div style={{ flex: '0 0 200px', fontSize: '0.85rem', fontWeight: 600, color: '#1A202C' }}>
                        {p.label}
                      </div>
                      {assigned ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#166534' }}>
                          <i className="ti ti-circle-check" style={{ fontSize: '1rem' }} />
                          <span>{assigned.displayName} — {assigned.pending ? 'invite pending' : 'confirmed'}</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
                            <input
                              type="text" placeholder="Name"
                              value={fields[p.id]?.name ?? ''}
                              onChange={e => updateField(p.id, 'name', e.target.value)}
                              disabled={submitting}
                              style={{ flex: '1 1 140px', padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit' }}
                            />
                            <input
                              type="email" placeholder="Email"
                              value={fields[p.id]?.email ?? ''}
                              onChange={e => updateField(p.id, 'email', e.target.value)}
                              disabled={submitting}
                              style={{ flex: '1 1 180px', padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit' }}
                            />
                          </div>
                          {/* Policy rows only — Named Person rows above are untouched. */}
                          {p.category === POLICY_CATEGORY && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 100%' }}>
                              <input
                                type="url" placeholder="Link to the policy or document (optional)"
                                value={fields[p.id]?.link ?? ''}
                                onChange={e => updateLink(p.id, e.target.value)}
                                disabled={submitting || !!fields[p.id]?.existsNoLink}
                                style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit' }}
                              />
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: '#64748b', cursor: submitting ? 'default' : 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!!fields[p.id]?.existsNoLink}
                                  onChange={() => toggleExistsNoLink(p.id)}
                                  disabled={submitting || !!fields[p.id]?.link}
                                  style={{ accentColor: '#1B365D' }}
                                />
                                This policy exists, just don't have the link yet
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 28px', borderTop: '1px solid #E2E8F0', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <div style={{ fontSize: '0.8rem', flex: 1 }}>
                  {error && <span style={{ color: '#991b1b' }}>{error}</span>}
                  {!error && successNote && <span style={{ color: '#166534' }}>{successNote}</span>}
                </div>
                <button type="button" onClick={() => handleSubmit({ finishAfter: isLastCategory })} disabled={submitting} style={{
                  padding: '10px 22px', borderRadius: 9, border: 'none',
                  background: submitting ? '#94a3b8' : '#1B365D', color: '#fff',
                  fontSize: '0.88rem', fontWeight: 600, cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit',
                  flexShrink: 0,
                }}>
                  {submitting ? 'Saving…' : isLastCategory ? 'Submit' : 'Submit & continue'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
