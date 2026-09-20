// Derives a barrier's domain/principle/category tags from the provision points it is
// linked to (barrier_provision_points), instead of the school picking tags directly.

export function tags(barrier) {
  const links  = barrier.barrier_provision_points ?? []
  const points = links.map(l => l.provision_points).filter(pp => pp && pp.active !== false)

  const domainIds = [...new Set(points.map(pp => pp.sub_domains?.domain_id).filter(Boolean))]
  const domains   = domainIds.length > 0 ? domainIds : (barrier.domain_id ? [barrier.domain_id] : [])

  const principles = [...new Set(points.map(pp => pp.principle).filter(Boolean))]
  const categories = [...new Set(points.map(pp => pp.category).filter(Boolean))]

  return { domains, principles, categories }
}

// entries: rows with { school_id, provision_point_id, status } for the barrier's school.
export function activityState(barrier, entries) {
  const links = (barrier.barrier_provision_points ?? []).filter(l => l.provision_points?.active !== false)
  const hasActivity = links.some(l => {
    const entry = entries.find(e =>
      e.provision_point_id === l.provision_point_id && e.school_id === barrier.school_id
    )
    return entry?.status === 'in_place' || entry?.status === 'in_progress'
  })
  return hasActivity ? 'has_activity' : 'no_activity'
}
