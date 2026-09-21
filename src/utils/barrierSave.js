// Shared barrier create/update + provision-point link sync, used by both BarriersView
// (App.jsx) and the Inclusion Strategy wizard's barrier form. Extracted verbatim from
// BarriersView's own handleSave, with two deliberate, disclosed changes that apply to both
// callers: (1) link sync now inserts the added set before deleting the removed set (was
// delete-then-insert) — a failed insert now leaves the barrier with its old links intact,
// never fewer links than before; (2) on create, a link-insert failure deletes the
// just-created barrier row rather than leaving an orphan with no links.

// domain_id / sub_domain_id are derived, never picked directly: from the first selected
// point in domain -> sub-domain -> point display order (not click order), or from the
// chosen domain when "None of these fit" is used. `provisionPoints` must already be sorted
// in that order (as BarriersView's own fetch already sorts it).
export function deriveBarrierDomain({ noneFit, noneFitDomain, selectedLinks, provisionPoints }) {
  if (noneFit) {
    return { domainId: noneFitDomain, subDomainId: null }
  }
  const firstPoint = provisionPoints.find(pp => selectedLinks.has(pp.id))
  return {
    domainId: firstPoint?.sub_domains?.domain_id ?? null,
    subDomainId: firstPoint?.sub_domain_id ?? null,
  }
}

export function buildBarrierPayload(form, domainId, subDomainId) {
  return {
    description:    form.description.trim(),
    domain_id:      domainId,
    sub_domain_id:  subDomainId,
    student_groups: form.student_groups ?? {},
    scale:          form.scale || null,
    source:         form.source || null,
    status:         form.status || 'active',
    actions:        form.actions?.trim() || null,
    date_identified:form.date_identified || null,
    next_review_due:form.next_review_due || null,
  }
}

// Insert the added links first, then delete the removed ones — see the file-level note on
// why this order matters. Errors from either step are thrown, never swallowed; the caller
// decides what to do (saveBarrier below rolls back a fresh barrier on an insert failure).
export async function syncBarrierLinks({ sb, barrierId, existingLinkIds, selectedLinks }) {
  const toAdd    = [...selectedLinks].filter(id => !existingLinkIds.has(id))
  const toRemove = [...existingLinkIds].filter(id => !selectedLinks.has(id))

  if (toAdd.length > 0) {
    const rows = toAdd.map(provision_point_id => ({ barrier_id: barrierId, provision_point_id }))
    const { error } = await sb.from('barrier_provision_points').insert(rows)
    if (error) throw error
  }
  if (toRemove.length > 0) {
    const { error } = await sb.from('barrier_provision_points').delete()
      .eq('barrier_id', barrierId).in('provision_point_id', toRemove)
    if (error) throw error
  }
}

// Validates required fields (description, and either a provision-point selection or "None
// of these fit"), then creates or updates the barrier row and syncs its links. Returns
// { barrierId, error } — error is a user-facing string, or null on success. Never throws.
export async function saveBarrier({ sb, school, editBarrier, form, selectedLinks, noneFit, noneFitDomain, provisionPoints }) {
  const errors = {}
  if (!form.description?.trim()) errors.description = 'Description is required'
  if (noneFit) {
    if (!noneFitDomain) errors.domain = 'Domain is required'
  } else if (selectedLinks.size === 0) {
    errors.domain = 'Select at least one provision point, or choose "None of these fit"'
  }
  if (Object.keys(errors).length) return { barrierId: null, error: null, fieldErrors: errors }

  const { domainId, subDomainId } = deriveBarrierDomain({ noneFit, noneFitDomain, selectedLinks, provisionPoints })
  const payload = buildBarrierPayload(form, domainId, subDomainId)
  const existingLinkIds = new Set((editBarrier?.barrier_provision_points ?? []).map(l => l.provision_point_id))

  let barrierId
  try {
    if (editBarrier) {
      const { error } = await sb.from('barriers').update(payload).eq('id', editBarrier.id)
      if (error) throw error
      barrierId = editBarrier.id
    } else {
      const { data, error } = await sb.from('barriers').insert({ ...payload, school_id: school }).select('id').single()
      if (error) throw error
      barrierId = data.id
    }

    await syncBarrierLinks({ sb, barrierId, existingLinkIds, selectedLinks })

    return { barrierId, error: null, fieldErrors: null }
  } catch (err) {
    console.error('Barrier save error:', err)
    // A fresh barrier that failed its own link sync has no home yet — roll it back rather
    // than leaving an orphan with no links in the list. An edit's barrier row is left as
    // already-saved even if the link sync fails, matching syncBarrierLinks' own
    // insert-before-delete safety: the barrier still has at least its old links.
    if (!editBarrier && barrierId) {
      await sb.from('barriers').delete().eq('id', barrierId)
    }
    return { barrierId: null, error: 'Could not save — please try again.', fieldErrors: null }
  }
}
